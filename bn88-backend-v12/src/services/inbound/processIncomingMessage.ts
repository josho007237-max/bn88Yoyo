// src/services/inbound/processIncomingMessage.ts
import { toJsonValue as normalizeJson } from "../../lib/jsonValue.js";
import { MessageType, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { createCaseWithDedupe } from "../cases";
import { getOpenAIClientForBot } from "../openai/getOpenAIClientForBot";
import {
  detectReplyLang,
  langLabel,
  fallbackNeedMoreInfo,
  fallbackSystemError,
} from "../../utils/detectLang";
import { config } from "../../config";
import { createRequestLogger } from "../../utils/logger";
import {
  ActionExecutionResult,
  ActionItem,
  SupportedPlatform,
  executeActions,
  safeBroadcast,
} from "../actions";
export type { SupportedPlatform } from "../actions";
import { ensureConversation } from "../conversation";
import { findFaqAnswer } from "../faq";
import { recordMessageStat } from "../stats";

const toJson = (v: unknown) => normalizeJson(v);

export type ProcessIncomingParams = {
  botId: string;
  platform: SupportedPlatform;
  userId: string;
  text: string;
  messageType?: MessageType;
  attachmentUrl?: string | null;
  attachmentMeta?: unknown;

  displayName?: string;
  platformMessageId?: string;
  rawPayload?: unknown;
  requestId?: string;
};

export type ProcessIncomingResult = {
  reply: string;
  intent: string;
  isIssue: boolean;
  actions?: ActionExecutionResult[];
};

type BotWithRelations = NonNullable<
  Awaited<ReturnType<typeof loadBotWithRelations>>
>;

async function loadBotWithRelations(botId: string) {
  if (!botId) return null;

  return prisma.bot.findUnique({
    where: { id: botId },
    include: {
      secret: true,
      config: {
        include: {
          preset: true,
        },
      },
      intents: true,
    },
  });
}

type KnowledgeChunkLite = {
  id: string;
  docId: string;
  docTitle: string;
  content: string;
};

async function getRelevantKnowledgeForBotMessage(params: {
  botId: string;
  tenant: string;
  text: string;
  limit?: number;
}): Promise<KnowledgeChunkLite[]> {
  const { botId, tenant, text, limit = 5 } = params;

  const keywords = text
    .split(/\s+/)
    .map((w) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((w) => w.length >= 3)
    .slice(0, 5);

  const whereClause: any = {
    doc: {
      tenant,
      status: "active",
      bots: { some: { botId } },
    },
  };

  if (keywords.length > 0) {
    whereClause.OR = keywords.map((kw) => ({ content: { contains: kw } }));
  }

  const chunks = await prisma.knowledgeChunk.findMany({
    where: whereClause,
    include: {
      doc: {
        select: {
          id: true,
          title: true,
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    take: limit,
  });

  return chunks.map((chunk) => ({
    id: chunk.id,
    docId: chunk.doc.id,
    docTitle: chunk.doc.title,
    content: chunk.content,
  }));
}

function buildKnowledgeSummary(chunks: KnowledgeChunkLite[]): {
  summary: string;
  docIds: string[];
  chunkIds: string[];
} {
  if (chunks.length === 0) return { summary: "", docIds: [], chunkIds: [] };

  const lines: string[] = [];
  let totalLength = 0;
  const maxTotalLength = 1800;
  const maxChunkLength = 360;

  for (const chunk of chunks) {
    if (totalLength >= maxTotalLength) break;
    const content = chunk.content.slice(0, maxChunkLength);
    const line = `- [doc: ${chunk.docTitle}] ${content}`;
    totalLength += line.length;
    lines.push(line);
  }

  return {
    summary: lines.join("\n"),
    docIds: Array.from(new Set(chunks.map((c) => c.docId))),
    chunkIds: chunks.map((c) => c.id),
  };
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function fallbackThanks(lang: string): string {
  if (lang === "lo") return "ຂອບໃຈເດີ";
  if (lang === "en") return "Thanks.";
  return "ขอบคุณค่ะ";
}

export async function processIncomingMessage(
  params: ProcessIncomingParams
): Promise<ProcessIncomingResult> {
  const {
    botId,
    platform,
    userId,
    text,
    displayName,
    platformMessageId,
    rawPayload,
    requestId,
  } = params;

  const log = createRequestLogger(requestId);
  const incomingType: MessageType = params.messageType ?? MessageType.TEXT;

  const safeText =
    text?.trim() ||
    (incomingType !== MessageType.TEXT
      ? `[${incomingType.toLowerCase()}]`
      : "");

  const replyLang = detectReplyLang(safeText);

  const fallback: ProcessIncomingResult = {
    reply: fallbackSystemError(replyLang),
    intent: "system_error",
    isIssue: false,
    actions: [],
  };

  let actionResults: ActionExecutionResult[] = [];
  let aiActions: ActionItem[] = [];
  let skipAi = false;
  let faqMeta: { faqId: string } | null = null;
  let faqAnswer: string | null = null;

  try {
    const bot = await loadBotWithRelations(botId);

    if (!bot) {
      console.warn("[processIncomingMessage] bot not found:", { botId });
      return fallback;
    }
    if (!bot.config) {
      console.warn("[processIncomingMessage] bot config missing:", { botId });
      return fallback;
    }

    const aiEnabled = bot.config.aiEnabled ?? true;
    if (!aiEnabled) {
      console.log("[processIncomingMessage] AI disabled for this bot", {
        botId: bot.id,
      });
      skipAi = true;
    }

    const now = new Date();

    // 1) upsert ChatSession
    const session = await prisma.chatSession.upsert({
      where: {
        botId_userId: {
          botId,
          userId,
        },
      },
      update: {
        lastMessageAt: now,
        displayName,
        lastText: text,
        lastDirection: "user",
        hasProblem: false,
      },
      create: {
        tenant: bot.tenant,
        botId,
        platform,
        userId,
        displayName,
        status: "open",
        lastMessageAt: now,
        lastText: text,
        lastDirection: "user",
        hasProblem: false,
      },
    });

    const conversation = await ensureConversation({
      botId: bot.id,
      tenant: bot.tenant,
      userId,
      platform,
      requestId,
    });

    // 2) dedupe by platformMessageId
    if (platformMessageId) {
      const dup = await prisma.chatMessage.findFirst({
        where: {
          sessionId: session.id,
          platformMessageId,
        },
        select: { id: true },
      });

      if (dup) {
        console.log("[processIncomingMessage] duplicate message, skip", {
          sessionId: session.id,
          platformMessageId,
        });

        return {
          reply: "",
          intent: "duplicate",
          isIssue: false,
        };
      }
    }

    // 3) create ChatMessage (user)
    const userChatMessage = await prisma.chatMessage.create({
      data: {
        tenant: bot.tenant,
        botId: bot.id,
        platform,
        sessionId: session.id,
        conversationId: conversation.id,
        senderType: "user",
        type: incomingType,
        text: safeText,
        attachmentUrl: params.attachmentUrl ?? null,
        attachmentMeta: params.attachmentMeta
          ? toJson(params.attachmentMeta)
          : null,
        platformMessageId: platformMessageId ?? null,
        meta: toJson({
          source: platform,
          rawPayload: rawPayload ?? null,
        }),
      },
      select: {
        id: true,
        createdAt: true,
        text: true,
        type: true,
        conversationId: true,
        attachmentUrl: true,
        attachmentMeta: true,
      },
    });

    await recordMessageStat(bot.id, "in");

    // SSE: new user message
    safeBroadcast({
      type: "chat:message:new",
      tenant: bot.tenant,
      data: {
        botId: bot.id,
        sessionId: session.id,
        conversationId: conversation.id,
        message: userChatMessage,
        from: "user",
      },
    });

    // ==== กรณี non-text: ตอบขอข้อมูลเพิ่มเติม แล้วจบเลย ====
    if (incomingType !== MessageType.TEXT) {
      const reply = fallbackNeedMoreInfo(replyLang);

      const botChatMessage = await prisma.chatMessage.create({
        data: {
          tenant: bot.tenant,
          botId: bot.id,
          platform,
          sessionId: session.id,
          conversationId: conversation.id,
          senderType: "bot",
          type: MessageType.TEXT,
          text: reply,
          meta: toJson({
            source: platform,
            via: "auto_reply",
            intent: "non_text",
            isIssue: false,
            caseId: null,
            usedKnowledge: false,
            knowledgeDocIds: [],
            knowledgeChunkIds: [],
            faqId: null,
          }),
        },
        select: {
          id: true,
          text: true,
          type: true,
          conversationId: true,
          createdAt: true,
        },
      });

      await recordMessageStat(bot.id, "out");

      // SSE: new bot message
      safeBroadcast({
        type: "chat:message:new",
        tenant: bot.tenant,
        data: {
          botId: bot.id,
          sessionId: session.id,
          conversationId: conversation.id,
          message: botChatMessage,
          from: "bot",
        },
      });

      await prisma.chatSession.update({
        where: { id: session.id },
        data: {
          lastMessageAt: botChatMessage.createdAt,
          lastText: botChatMessage.text,
          lastDirection: "bot",
        },
      });

      return { reply, intent: "non_text", isIssue: false, actions: [] };
    }

    // 4) FAQ ก่อน
    const faq = await findFaqAnswer(bot.id, safeText, requestId);
    if (faq) {
      skipAi = true;
      faqMeta = { faqId: faq.faqId };
      faqAnswer = faq.answer;
    }

    // 5) OpenAI client
    let openai: ReturnType<typeof getOpenAIClientForBot> | null = null;
    try {
      openai = skipAi ? null : getOpenAIClientForBot(bot as BotWithRelations);
    } catch (err) {
      console.error(
        "[processIncomingMessage] getOpenAIClientForBot error",
        (err as any)?.message ?? err
      );
      return fallback;
    }

    // 5.1) knowledge
    const knowledgeChunks = await getRelevantKnowledgeForBotMessage({
      botId: bot.id,
      tenant: bot.tenant,
      text: safeText,
    });

    const {
      summary: knowledgeSummary,
      docIds: knowledgeDocIds,
      chunkIds,
    } = buildKnowledgeSummary(knowledgeChunks);

    if (knowledgeChunks.length > 0) {
      console.log("[processIncomingMessage] knowledge", {
        botId: bot.id,
        docs: knowledgeDocIds,
        chunks: chunkIds.slice(0, 10),
      });
    }

    // 6) intents for prompt
    const intentsForPrompt =
      bot.intents && bot.intents.length > 0
        ? bot.intents
            .map((it) => {
              const keywords = Array.isArray(it.keywords)
                ? (it.keywords as string[])
                : [];

              return `- code: ${it.code}
  title: ${it.title}
  keywords: ${keywords.join(", ")}`;
            })
            .join("\n")
        : 'ไม่พบ intent ใด ๆ ให้ตอบ intent = "other"';

    const baseSystemPrompt =
      bot.config.systemPrompt ||
      "คุณคือแอดมินดูแลลูกค้า ให้ตอบแบบสุภาพ กระชับ และเป็นมนุษย์";

    const classificationInstruction = `
คุณมีหน้าที่:
1) วิเคราะห์ข้อความลูกค้า
2) เลือก intent หนึ่งตัวจากรายการด้านล่าง (ถ้าไม่เข้า ให้ใช้ "other")
3) ตัดสินใจว่าเป็น "เคสปัญหา" จริงไหม (เช่น ฝากไม่เข้า, ถอนไม่ได้, ทำรายการไม่สำเร็จ ฯลฯ)
4) สร้างข้อความตอบกลับลูกค้า

แพลตฟอร์มที่ลูกค้าใช้งาน: ${platform}

รายการ intent:
${intentsForPrompt}

ให้ตอบกลับในรูปแบบ JSON เท่านั้น ห้ามใส่ข้อความอื่นเพิ่ม
โครงสร้าง JSON:

{
  "reply": "ข้อความที่ใช้ตอบลูกค้า",
  "intent": "code ของ intent เช่น deposit, withdraw, register, kyc, other",
  "isIssue": true หรือ false
}
`.trim();

    const languagePolicy = `
LANGUAGE POLICY:
- The JSON field "reply" MUST be written in ${langLabel(replyLang)}.
- If the user mixes languages, follow the language used in the latest user message.
- Keep brand names / usernames as-is. Do not translate proper nouns.
`.trim();

    const systemPrompt = `${baseSystemPrompt}\n\n${languagePolicy}\n\n${classificationInstruction}`;
    const model = bot.config.model || "gpt-4o-mini";

    let rawContent: any = "{}";

    if (!skipAi && openai) {
      console.log("[AI] calling OpenAI", {
        botId: bot.id,
        model,
        text: safeText,
      });

      const completion = await openai.chat.completions.create({
        model,
        temperature: bot.config.temperature ?? 0.4,
        top_p: bot.config.topP ?? 1,
        max_tokens: bot.config.maxTokens ?? 800,
        messages: [
          { role: "system", content: systemPrompt },
          knowledgeSummary
            ? {
                role: "system",
                content:
                  "นี่คือข้อมูลภายใน (Knowledge Base) ที่ต้องใช้ตอบลูกค้า ถ้าคำถามเกี่ยวข้องให้ยึดข้อมูลนี้เป็นหลัก:\n" +
                  knowledgeSummary,
              }
            : null,
          { role: "user", content: safeText },
        ].filter(Boolean) as any,
      });

      rawContent = completion.choices?.[0]?.message?.content ?? "{}";
    } else {
      const replyText =
        faqAnswer ??
        (aiEnabled
          ? safeText
          : "ขณะนี้ระบบ AI ถูกปิดอยู่ค่ะ พี่พลอยจะยังไม่ตอบอัตโนมัติให้นะคะ");

      const intentCode = faqMeta?.faqId ? "faq" : "other";

      rawContent = JSON.stringify({
        reply: replyText,
        intent: intentCode,
        isIssue: false,
      });
    }

    if (Array.isArray(rawContent)) {
      rawContent = rawContent
        .map((p: any) =>
          typeof p === "string" ? p : (p?.text ?? p?.content ?? "")
        )
        .join("");
    }

    let parsed: ProcessIncomingResult = {
      reply: fallbackThanks(replyLang),
      intent: "other",
      isIssue: false,
      actions: [],
    };

    try {
      const json = JSON.parse(String(rawContent));

      parsed = {
        reply:
          typeof json.reply === "string"
            ? json.reply
            : fallbackThanks(replyLang),
        intent: typeof json.intent === "string" ? json.intent : "other",
        isIssue: Boolean(json.isIssue),
        actions: [],
      };

      aiActions = Array.isArray(json.actions)
        ? (json.actions as ActionItem[])
        : [];
    } catch (err) {
      console.error(
        "[processIncomingMessage] JSON parse error from GPT",
        err,
        rawContent
      );
    }

    const reply = parsed.reply || fallbackThanks(replyLang);
    const intent = parsed.intent || "other";
    const isIssue = Boolean(parsed.isIssue);

    // 7) case + stats
    let caseId: string | null = null;
    const dateKey = todayKey();

    if (isIssue) {
      try {
        const { caseItem, created } = await createCaseWithDedupe({
          tenant: bot.tenant,
          botId: bot.id,
          platform,
          sessionId: session.id,
          userId,
          kind: intent,
          text,
          meta: toJson({
            intent,
            isIssue,
            source: platform,
            rawPayload: rawPayload ?? null,
          }),
          dedupeWindowMs: 15 * 60 * 1000,
          noteVia: "text",
        });

        caseId = caseItem.id;

        await prisma.chatSession.update({
          where: { id: session.id },
          data: { hasProblem: true },
        });

        await prisma.statDaily.upsert({
          where: {
            botId_dateKey: {
              botId: bot.id,
              dateKey,
            },
          },
          update: {
            total: { increment: 1 },
            text: { increment: 1 },
          },
          create: {
            botId: bot.id,
            tenant: bot.tenant,
            dateKey,
            total: 1,
            text: 1,
            follow: 0,
            unfollow: 0,
          },
        });

        if (created) {
          safeBroadcast({
            type: "case:new",
            tenant: bot.tenant,
            botId: bot.id,
            case: {
              id: caseItem.id,
              text: caseItem.text,
              kind: caseItem.kind,
              createdAt: caseItem.createdAt,
              sessionId: session.id,
            },
          });
        } else {
          safeBroadcast({
            type: "case:update",
            tenant: bot.tenant,
            botId: bot.id,
            case: {
              id: caseItem.id,
              status: caseItem.status,
              updatedAt: caseItem.updatedAt,
              sessionId: session.id,
              kind: caseItem.kind,
            },
          });
        }

        safeBroadcast({
          type: "stats:update",
          tenant: bot.tenant,
          botId: bot.id,
          dateKey,
          delta: { total: 1, text: 1 },
        });
      } catch (err) {
        console.error(
          "[processIncomingMessage] error while creating case/stat",
          (err as any)?.message ?? err
        );
      }
    } else {
      try {
        await prisma.statDaily.upsert({
          where: {
            botId_dateKey: {
              botId: bot.id,
              dateKey,
            },
          },
          update: {
            total: { increment: 1 },
            text: { increment: 1 },
          },
          create: {
            botId: bot.id,
            tenant: bot.tenant,
            dateKey,
            total: 1,
            text: 1,
            follow: 0,
            unfollow: 0,
          },
        });

        safeBroadcast({
          type: "stats:update",
          tenant: bot.tenant,
          botId: bot.id,
          dateKey,
          delta: { total: 1, text: 1 },
        });
      } catch (err) {
        console.error(
          "[processIncomingMessage] statDaily non-issue error",
          (err as any)?.message ?? err
        );
      }
    }

    // 8) bot message + update session
    if (reply) {
      try {
        const botChatMessage = await prisma.chatMessage.create({
          data: {
            tenant: bot.tenant,
            botId: bot.id,
            platform,
            sessionId: session.id,
            conversationId: conversation.id,
            senderType: "bot",
            type: MessageType.TEXT,
            text: reply,
            meta: toJson({
              source: platform,
              via: "auto_reply",
              intent,
              isIssue,
              caseId,
              usedKnowledge: knowledgeChunks.length > 0,
              knowledgeDocIds,
              knowledgeChunkIds: chunkIds,
              faqId: faqMeta?.faqId ?? null,
            }),
          },
          select: {
            id: true,
            text: true,
            type: true,
            conversationId: true,
            createdAt: true,
          },
        });

        await recordMessageStat(bot.id, "out");

        // SSE: new bot message
        safeBroadcast({
          type: "chat:message:new",
          tenant: bot.tenant,
          data: {
            botId: bot.id,
            sessionId: session.id,
            conversationId: conversation.id,
            message: botChatMessage,
            from: "bot",
          },
        });

        await prisma.chatSession.update({
          where: { id: session.id },
          data: {
            lastMessageAt: botChatMessage.createdAt,
            lastText: botChatMessage.text,
            lastDirection: "bot",
          },
        });
      } catch (err) {
        console.error(
          "[processIncomingMessage] ingest bot message error",
          (err as any)?.message ?? err
        );
      }
    }

    // 9) actions
    const actionsToRun = aiActions;
    if (actionsToRun.length > 0) {
      actionResults = await executeActions(actionsToRun, {
        bot: bot as BotWithRelations,
        session,
        conversation,
        platform,
        userId,
        requestId,
        log,
      });
    }

    return { reply, intent, isIssue, actions: actionResults };
  } catch (err) {
    console.error(
      "[processIncomingMessage] fatal error",
      (err as any)?.message ?? err
    );
    return { ...fallback, actions: actionResults };
  }
}
