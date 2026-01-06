// src/routes/admin/chat.ts
import { Router, type Request, type Response } from "express";
import { prisma } from "../../lib/prisma";
import { config } from "../../config";
import { sseHub } from "../../lib/sseHub";
import { sendTelegramMessage } from "../../services/telegram";
import { MessageType } from "@prisma/client";
import { z } from "zod";
import { recordDeliveryMetric } from "../metrics.live";
import { createRequestLogger, getRequestId } from "../../utils/logger";
import { requirePermission } from "../../middleware/basicAuth";
import { ensureConversation } from "../../services/conversation";
import {
  buildFlexMessage,
  type FlexButton,
  type FlexMessageInput,
} from "../../services/lineFlex";

const router = Router();
const TENANT_DEFAULT = process.env.TENANT_DEFAULT || "bn9";

const MESSAGE_TYPES = [
  "TEXT",
  "IMAGE",
  "FILE",
  "STICKER",
  "SYSTEM",
  "RICH",
  "INLINE_KEYBOARD",
] as const satisfies MessageType[];

const updateSessionMetaSchema = z.object({
  status: z.enum(["open", "pending", "closed"]).optional(),
  tags: z.union([z.array(z.string().min(1).max(50)), z.string()]).optional(),
  hasProblem: z.boolean().optional(),
});

const replyPayloadSchema = z.object({
  type: z.enum(MESSAGE_TYPES as [MessageType, ...MessageType[]]).optional(),
  text: z.string().optional(),
  attachmentUrl: z.string().url().optional(),
  attachmentMeta: z.any().optional(),
});

const flexButtonSchema = z.object({
  label: z.string().min(1),
  action: z.enum(["uri", "message", "postback"] as const),
  value: z.string().min(1),
});

const richPayloadSchema = z.object({
  sessionId: z.string().min(1),
  platform: z.enum(["line", "telegram"]).optional(),
  title: z.string().min(1),
  body: z.string().min(1),
  imageUrl: z.string().url().optional(),
  buttons: z.array(flexButtonSchema).optional(),
  inlineKeyboard: z
    .array(
      z.array(
        z.object({
          text: z.string().min(1),
          callbackData: z.string().min(1),
        })
      )
    )
    .optional(),
  altText: z.string().optional(),
});

const searchQuerySchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().positive().max(500).optional(),
  platform: z.string().optional(),
  botId: z.string().optional(),
  userId: z.string().optional(),
});

const messagesQuerySchema = z.object({
  conversationId: z.string().trim().optional(),
  sessionId: z.string().trim().optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function getTenant(req: Request): string {
  return (
    (req.headers["x-tenant"] as string) ||
    config.TENANT_DEFAULT ||
    TENANT_DEFAULT
  );
}

type PrismaLike = typeof prisma;

type MessagesQuery = {
  tenant: string;
  conversationId?: string;
  sessionId?: string;
  limit?: number;
  offset?: number;
  requestId?: string;
};

async function fetchAdminChatMessages(
  params: MessagesQuery,
  client: PrismaLike = prisma
): Promise<{
  conversationId: string | null;
  items: any[];
  conversation?: any;
}> {
  let {
    tenant,
    conversationId,
    sessionId,
    limit = 200,
    offset = 0,
    requestId,
  } = params;

  if (!conversationId && !sessionId) {
    throw new HttpError(400, "conversationId_or_sessionId_required");
  }

  const log = createRequestLogger(requestId);
  let conversation: any | null = null;
  let session: any | null = null;

  // 1) ถ้ามี conversationId: ใช้ tenant จาก request ตามปกติ
  if (conversationId) {
    conversation = await client.conversation.findFirst({
      where: { id: conversationId, tenant },
      select: { id: true, botId: true, userId: true },
    });
    if (!conversation) throw new HttpError(404, "conversation_not_found");
  }

  // 2) ถ้ามี sessionId: หา session ด้วย id อย่างเดียวก่อน แล้ว “ยึด tenant จาก session”
  if (!conversationId && sessionId) {
    session = await client.chatSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        botId: true,
        platform: true,
        userId: true,
        tenant: true,
      },
    });
    if (!session) throw new HttpError(404, "chat_session_not_found");

    // ยึด tenant ที่ถูกต้องจาก session เพื่อกัน header/config เพี้ยน
    tenant = session.tenant;

    conversation = await client.conversation.findFirst({
      where: { botId: session.botId, userId: session.userId, tenant },
      select: { id: true, botId: true, userId: true },
    });
  }

  const whereClause = conversationId
    ? { tenant, conversationId }
    : { tenant, sessionId: session!.id };

  const rows = await client.chatMessage.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" }, // เอาล่าสุดก่อน
    skip: offset,
    take: limit,
    include: {
      conversation: { select: { id: true, botId: true, userId: true } },
      session: { select: { userId: true, platform: true } },
    },
  });

  const messages = rows.reverse(); // กลับให้ UI เรียงเก่า -> ใหม่

  const resolvedConversation =
    conversation ?? messages[0]?.conversation ?? undefined;

  log.info(
    `[Admin] chat/messages tenant=${tenant} conversationId=${
      resolvedConversation?.id ?? conversationId ?? null
    } count=${messages.length}`
  );

  const items = messages.map((m) => ({
    id: m.id,
    conversationId: m.conversationId ?? resolvedConversation?.id ?? null,
    sessionId: m.sessionId,
    userId: m.session?.userId ?? null,
    platform: m.platform,
    text: m.text,
    createdAt: m.createdAt,
    meta: m.meta,
    attachmentUrl: m.attachmentUrl,
    attachmentMeta: m.attachmentMeta,
    type: m.type,
    senderType: (m as any).senderType ?? null,
  }));

  return {
    conversationId: resolvedConversation?.id ?? conversationId ?? null,
    conversation: resolvedConversation
      ? {
          ...resolvedConversation,
          platform: messages[0]?.platform ?? session?.platform ?? null,
        }
      : undefined,
    items,
  };
}

async function sendLinePushMessage(
  channelAccessToken: string,
  toUserId: string,
  text: string
): Promise<boolean> {
  if (!channelAccessToken) {
    console.error("[LINE push] missing channelAccessToken");
    return false;
  }

  const f = (globalThis as any).fetch as typeof fetch | undefined;
  if (!f) {
    console.error("[LINE push] global fetch is not available");
    return false;
  }

  const resp = await f("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${channelAccessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: toUserId,
      messages: [{ type: "text", text }],
    }),
  });

  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    console.warn("[LINE push warning]", resp.status, t);
    return false;
  }

  return true;
}

function buildLineMessage(
  type: MessageType,
  text: string,
  attachmentUrl?: string | null,
  attachmentMeta?: Record<string, unknown>
) {
  if (type === "RICH" && attachmentMeta && "cards" in attachmentMeta) {
    return attachmentMeta as any;
  }

  if (type === "IMAGE" && attachmentUrl) {
    return {
      type: "image",
      originalContentUrl: attachmentUrl,
      previewImageUrl: attachmentUrl,
    } as any;
  }

  if (
    type === "STICKER" &&
    attachmentMeta?.packageId &&
    (attachmentMeta as any)?.stickerId
  ) {
    return {
      type: "sticker",
      packageId: String(attachmentMeta.packageId),
      stickerId: String((attachmentMeta as any).stickerId),
    } as any;
  }

  if (type === "FILE" && attachmentUrl) {
    return {
      type: "text",
      text: `${text || "ไฟล์แนบ"}: ${attachmentUrl}`,
    } as any;
  }

  return { type: "text", text: text || "" } as any;
}

async function sendLineRichMessage(
  channelAccessToken: string,
  toUserId: string,
  type: MessageType,
  text: string,
  attachmentUrl?: string | null,
  attachmentMeta?: Record<string, unknown>
): Promise<boolean> {
  const f = (globalThis as any).fetch as typeof fetch | undefined;
  if (!f) {
    console.error("[LINE push] global fetch is not available");
    return false;
  }

  const message = buildLineMessage(type, text, attachmentUrl, attachmentMeta);
  const resp = await f("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${channelAccessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: toUserId,
      messages: [message],
    }),
  });

  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    console.warn("[LINE push warning]", resp.status, t);
    return false;
  }

  return true;
}

async function sendTelegramRich(
  token: string,
  chatId: string,
  type: MessageType,
  text: string,
  attachmentUrl?: string | null,
  attachmentMeta?: Record<string, unknown>,
  replyToMessageId?: string | number
): Promise<boolean> {
  const f = (globalThis as any).fetch as typeof fetch | undefined;
  if (!f) {
    console.error("[Telegram] global fetch is not available");
    return false;
  }

  try {
    if (type === "INLINE_KEYBOARD") {
      const keyboard = (attachmentMeta as any)?.inlineKeyboard as
        | Array<Array<{ text: string; callbackData: string }>>
        | undefined;

      const inline_keyboard = keyboard?.map((row) =>
        row.map((btn) => ({ text: btn.text, callback_data: btn.callbackData }))
      );

      return await sendTelegramMessage(token, chatId, text, replyToMessageId, {
        inlineKeyboard: inline_keyboard,
      });
    }

    if (type === "IMAGE" && attachmentUrl) {
      const resp = await f(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          photo: attachmentUrl,
          caption: text || undefined,
          reply_to_message_id: replyToMessageId,
        }),
      });
      return resp.ok;
    }

    if (type === "FILE" && attachmentUrl) {
      const resp = await f(
        `https://api.telegram.org/bot${token}/sendDocument`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            document: attachmentUrl,
            caption: text || undefined,
            reply_to_message_id: replyToMessageId,
          }),
        }
      );
      return resp.ok;
    }

    if (type === "STICKER" && (attachmentMeta as any)?.stickerId) {
      const resp = await f(`https://api.telegram.org/bot${token}/sendSticker`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          sticker: String((attachmentMeta as any).stickerId),
          reply_to_message_id: replyToMessageId,
        }),
      });
      return resp.ok;
    }

    // default text
    return await sendTelegramMessage(token, chatId, text, replyToMessageId);
  } catch (err) {
    console.error("[Telegram] send rich error", err);
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* GET /api/admin/chat/sessions                                       */
/* ------------------------------------------------------------------ */

router.get(
  "/sessions",
  requirePermission(["manageCampaigns", "viewReports"]),
  async (req: Request, res: Response) => {
    const requestId = getRequestId(req);
    const log = createRequestLogger(requestId);

    try {
      const tenant = getTenant(req);

      const botId =
        typeof req.query.botId === "string" ? req.query.botId : undefined;

      const platform =
        typeof req.query.platform === "string"
          ? (req.query.platform as string)
          : undefined;

      const limit = Number(req.query.limit) || 50;

      const status =
        typeof req.query.status === "string" ? req.query.status : undefined;

      const isIssueParam =
        typeof req.query.isIssue === "string" ? req.query.isIssue : undefined;

      const q =
        typeof req.query.q === "string" && req.query.q.trim().length > 0
          ? req.query.q.trim()
          : undefined;

      const dateFrom =
        typeof req.query.dateFrom === "string" ? req.query.dateFrom : undefined;

      const dateTo =
        typeof req.query.dateTo === "string" ? req.query.dateTo : undefined;

      const where: any = {
        tenant,
      };

      if (botId) where.botId = botId;
      if (platform) where.platform = platform;

      if (status && ["open", "pending", "closed"].includes(status)) {
        where.status = status;
      }

      if (isIssueParam === "true") {
        where.hasProblem = true;
      } else if (isIssueParam === "false") {
        where.hasProblem = false;
      }

      if (dateFrom || dateTo) {
        where.lastMessageAt = {};
        if (dateFrom) where.lastMessageAt.gte = new Date(String(dateFrom));
        if (dateTo) {
          const to = new Date(String(dateTo));
          where.lastMessageAt.lte = to;
        }
      }

      if (q) {
        where.OR = [
          { userId: { contains: q } },
          { displayName: { contains: q } },
          { lastText: { contains: q } },
        ];
      }

      const sessions = await prisma.chatSession.findMany({
        where,
        orderBy: { lastMessageAt: "desc" },
        take: limit,
        select: {
          id: true,
          userId: true,
          displayName: true,
          platform: true,
          lastMessageAt: true,
          lastText: true,
          lastDirection: true,
          status: true,
          tags: true,
          caseCount: true,
          hasProblem: true,
          unread: true,
        },
      });

      log.info(
        {
          requestId,
          tenant,
          botId,
          platform,
          status,
          isIssueParam,
          q,
          dateFrom,
          dateTo,
          count: sessions.length,
        },
        "chat_sessions_ok"
      );

      return res.json({ ok: true, items: sessions });
    } catch (err: any) {
      console.error("[admin chat] list sessions error", err);
      return res
        .status(500)
        .json({ ok: false, message: "internal_error_list_sessions" });
    }
  }
);

/* ------------------------------------------------------------------ */
/* PATCH /api/admin/chat/sessions/:id/meta                            */
/* ------------------------------------------------------------------ */

router.patch(
  "/sessions/:id/meta",
  requirePermission(["manageCampaigns"]),
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const tenant = getTenant(req);
      const id = String(req.params.id || "").trim();

      const parsed = updateSessionMetaSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({
          ok: false,
          message: "invalid_input",
          issues: parsed.error.issues,
        });
      }

      const { status, tags, hasProblem } = parsed.data;

      const session = await prisma.chatSession.findFirst({
        where: { id, tenant },
      });
      if (!session) {
        return res
          .status(404)
          .json({ ok: false, message: "chat_session_not_found" });
      }

      // tags เก็บเป็น “string” แบบ JSON เสมอ (ปลอดภัยสุด ไม่ชน type DB)
      let tagsValue: string | undefined;

      if (Array.isArray(tags)) {
        tagsValue = tags
          .map((t) => t.trim())
          .filter(Boolean)
          .join(", ");
      } else if (typeof tags === "string") {
        tagsValue = tags.trim();
      }

      const updated = await prisma.chatSession.update({
        where: { id: session.id },
        data: {
          ...(status ? { status } : {}),
          ...(tagsValue !== undefined ? { tags: tagsValue as any } : {}),
          ...(hasProblem !== undefined ? { hasProblem } : {}),
        },
        select: {
          id: true,
          status: true,
          tags: true,
          caseCount: true,
          hasProblem: true,
          unread: true,
        },
      });

      // ส่ง SSE ให้ FE รีเฟรชได้
      try {
        sseHub.broadcast({
          type: "chat:session:meta_updated",
          tenant,
          botId: session.botId,
          sessionId: session.id,
          status: updated.status,
          tags: updated.tags,
          hasProblem: updated.hasProblem,
        } as any);
      } catch (e) {
        console.warn("[admin chat meta] SSE broadcast warn", e);
      }

      return res.json({ ok: true, session: updated });
    } catch (err) {
      console.error("[admin chat] update meta error", err);
      return res
        .status(500)
        .json({ ok: false, message: "internal_error_update_meta" });
    }
  }
);

/* ------------------------------------------------------------------ */
/* GET /api/admin/chat/search                                         */
/* ------------------------------------------------------------------ */

router.get(
  "/search",
  requirePermission(["manageCampaigns", "viewReports"]),
  async (req: Request, res: Response): Promise<Response> => {
    const requestId = getRequestId(req);
    const log = createRequestLogger(requestId);

    try {
      const tenant = getTenant(req);
      const parsed = searchQuerySchema.safeParse(req.query ?? {});
      if (!parsed.success) {
        return res.status(400).json({ ok: false, message: "invalid_query" });
      }

      const { q, limit = 100, platform, botId, userId } = parsed.data;

      const messages = await prisma.chatMessage.findMany({
        where: {
          tenant,
          ...(platform ? { platform } : {}),
          ...(botId ? { botId } : {}),
          ...(userId ? { session: { userId } } : {}),
          OR: [
            { text: { contains: q } },

            // ✅ SQLite: path ต้องเป็น string (ไม่ใช่ ["fileName"])
            {
              attachmentMeta: {
                path: "fileName",
                string_contains: q,
              } as any,
            },
            {
              attachmentMeta: {
                path: "mimeType",
                string_contains: q,
              } as any,
            },
          ],
        },
        include: {
          session: {
            select: {
              id: true,
              platform: true,
              userId: true,
              displayName: true,
              botId: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      });

      log.info(
        { requestId, q, limit, count: messages.length },
        "chat_search_ok"
      );

      return res.json({ ok: true, items: messages });
    } catch (err: any) {
      log.error({ err, requestId }, "chat_search_error");
      return res
        .status(500)
        .json({ ok: false, message: "internal_error_search" });
    }
  }
);

/* ------------------------------------------------------------------ */
/* GET /api/admin/chat/messages                                       */
/* ------------------------------------------------------------------ */

router.get(
  "/messages",
  requirePermission(["manageCampaigns", "viewReports"]),
  async (req: Request, res: Response): Promise<Response> => {
    const requestId = getRequestId(req);
    const log = createRequestLogger(requestId);

    try {
      const tenant = getTenant(req);
      const parsed = messagesQuerySchema.safeParse(req.query ?? {});
      if (!parsed.success) {
        return res.status(400).json({ ok: false, message: "invalid_query" });
      }

      const {
        conversationId,
        sessionId,
        limit = 200,
        offset = 0,
      } = parsed.data;

      if (!conversationId && !sessionId) {
        return res.status(400).json({
          ok: false,
          message: "conversationId_or_sessionId_required",
        });
      }

      const result = await fetchAdminChatMessages(
        { tenant, conversationId, sessionId, limit, offset, requestId },
        prisma
      );

      log.info(
        `[Admin] chat/messages conversationId=${result.conversationId} count=${result.items.length}`
      );

      return res.json({ ok: true, ...result });
    } catch (err: any) {
      if (err instanceof HttpError) {
        return res.status(err.status).json({ ok: false, message: err.message });
      }
      log.error({ err, requestId }, "chat_messages_error");
      return res.status(500).json({
        ok: false,
        message: "internal_error_list_messages",
      });
    }
  }
);

/* ------------------------------------------------------------------ */
/* GET /api/admin/chat/sessions/:id/messages                          */
/* - ใช้ logic เดียวกับ /api/admin/chat/messages                      */
/* ------------------------------------------------------------------ */

router.get(
  "/sessions/:id/messages",
  requirePermission(["manageCampaigns", "viewReports"]),
  async (req: Request, res: Response): Promise<Response> => {
    const requestId = getRequestId(req);
    const log = createRequestLogger(requestId);

    try {
      const tenant = getTenant(req);
      const sessionId = String(req.params.id || "").trim();
      const limit = Math.min(Number(req.query.limit ?? 200) || 200, 500);
      const offset = Math.max(Number(req.query.offset ?? 0) || 0, 0);

      log.info(
        { tenant, sessionId, limit, offset },
        "chat_session_messages_request"
      );

      const result = await fetchAdminChatMessages(
        { tenant, sessionId, limit, offset, requestId },
        prisma
      );

      return res.json({ ok: true, ...result });
    } catch (err: any) {
      if (err instanceof HttpError) {
        return res.status(err.status).json({ ok: false, message: err.message });
      }
      log.error({ err, requestId }, "chat_session_messages_error");
      return res
        .status(500)
        .json({ ok: false, message: "internal_error_list_messages" });
    }
  }
);

/* ------------------------------------------------------------------ */
/* GET /api/admin/chat/line-content/:id                               */
/* - รองรับทั้ง ChatMessage.id และ LINE messageId                     */
/* ------------------------------------------------------------------ */

router.get(
  "/line-content/:id",
  requirePermission(["manageCampaigns", "viewReports"]),
  async (req: Request, res: Response): Promise<Response> => {
    const requestId = getRequestId(req);
    const log = createRequestLogger(requestId);

    try {
      const tenant = getTenant(req);
      const id = String(req.params.id || "").trim();

      if (!id) {
        return res
          .status(400)
          .json({ ok: false, message: "line_message_id_required" });
      }

      // 1) ✅ ถ้า frontend ส่ง m.id (ChatMessage.id) -> หา message ด้วย id ก่อน
      let msg = await prisma.chatMessage.findFirst({
        where: { id, tenant },
        select: {
          botId: true,
          platform: true,
          attachmentMeta: true,
        },
      });

      // 2) ถ้าไม่เจอ ค่อย fallback หาโดย attachmentMeta.messageId (กรณีส่ง LINE messageId มา)
      if (!msg) {
        msg = await prisma.chatMessage.findFirst({
          where: {
            tenant,
            platform: "line",
            attachmentMeta: {
              // ✅ SQLite: path ต้องเป็น string
              path: "messageId",
              equals: id,
            } as any,
          },
          select: { botId: true, platform: true, attachmentMeta: true },
          orderBy: { createdAt: "desc" },
        });
      }

      if (!msg) {
        return res
          .status(404)
          .json({ ok: false, message: "line_message_not_found" });
      }

      if (msg.platform !== "line") {
        return res
          .status(400)
          .json({ ok: false, message: "not_a_line_message" });
      }

      // ดึง LINE messageId จาก meta (หรือถ้า fallback แล้ว id คือ LINE messageId ก็ใช้ id)
      const meta: any = msg.attachmentMeta ?? {};
      const lineMessageId: string = String(
        meta.messageId || meta.lineMessageId || meta.contentMessageId || id
      ).trim();

      if (!lineMessageId) {
        return res.status(400).json({
          ok: false,
          message: "line_message_id_missing_in_meta",
        });
      }

      const bot = await prisma.bot.findUnique({
        where: { id: msg.botId },
        include: { secret: true },
      });

      const channelAccessToken = bot?.secret?.channelAccessToken;
      if (!bot || !channelAccessToken) {
        return res
          .status(404)
          .json({ ok: false, message: "line_token_not_found" });
      }

      const f = (globalThis as any).fetch as typeof fetch | undefined;
      if (!f) {
        log.error("[line-content] global fetch not available");
        return res
          .status(500)
          .json({ ok: false, message: "internal_error_fetch" });
      }

      const url = `https://api-data.line.me/v2/bot/message/${lineMessageId}/content`;
      const resp = await f(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${channelAccessToken}`,
        },
      });

      if (!resp.ok) {
        const t = await resp.text().catch(() => "");
        log.warn("[line-content] LINE error", resp.status, t);
        return res.status(resp.status).send(t);
      }

      const arrayBuf = await resp.arrayBuffer();
      const buf = Buffer.from(arrayBuf);
      const contentType =
        resp.headers.get("content-type") || "application/octet-stream";

      res.setHeader("Content-Type", contentType);

      const fileName: string | undefined = meta.fileName;
      if (fileName) {
        // ปลอดภัยกว่า encode เฉย ๆ นิดนึง (กัน quote)
        const safeName = encodeURIComponent(fileName).replace(/%22/g, "");
        res.setHeader("Content-Disposition", `inline; filename="${safeName}"`);
      }

      return res.send(buf);
    } catch (err: any) {
      log.error({ err, requestId }, "line_content_error");
      return res
        .status(500)
        .json({ ok: false, message: "internal_error_line_content" });
    }
  }
);

/* ------------------------------------------------------------------ */
/* POST /api/admin/chat/rich-message                                  */
/* ------------------------------------------------------------------ */

router.post(
  "/rich-message",
  requirePermission(["manageCampaigns"]),
  async (req: Request, res: Response): Promise<Response> => {
    const requestId = getRequestId(req);
    const log = createRequestLogger(requestId);

    try {
      const tenant = getTenant(req);
      const parsed = richPayloadSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ ok: false, message: "invalid_payload" });
      }

      const payload = parsed.data;
      const session = await prisma.chatSession.findFirst({
        where: { id: payload.sessionId, tenant },
        include: { bot: { include: { secret: true } } },
      });

      if (!session?.bot) {
        return res
          .status(404)
          .json({ ok: false, message: "chat_session_not_found" });
      }

      if (payload.platform && payload.platform !== session.platform) {
        return res
          .status(400)
          .json({ ok: false, message: "platform_mismatch" });
      }

      const bot = session.bot;
      const conversation = await ensureConversation({
        botId: bot.id,
        tenant: session.tenant,
        userId: session.userId,
        platform: session.platform,
        requestId,
      });

      const messageText = `${payload.title}\n${payload.body}`;
      let delivered = false;
      let messageType: MessageType = "RICH";
      let attachmentMeta: any = null;
      let attachmentUrl: string | null = payload.imageUrl ?? null;

      if (session.platform === "line") {
        const token = bot.secret?.channelAccessToken;
        if (!token) {
          return res
            .status(400)
            .json({ ok: false, message: "line_token_missing" });
        }

        const flexPayload: FlexMessageInput = {
          altText: payload.altText || payload.title,
          cards: [
            {
              title: payload.title,
              body: payload.body,
              imageUrl: payload.imageUrl,
              buttons: (payload.buttons as FlexButton[] | undefined) ?? [],
            },
          ],
        };
        const flexMessage = buildFlexMessage(flexPayload);
        attachmentMeta = flexMessage;

        delivered = await sendLineRichMessage(
          token,
          session.userId,
          "RICH",
          messageText,
          attachmentUrl,
          flexMessage as any
        );
      } else if (session.platform === "telegram") {
        const token = bot.secret?.telegramBotToken;
        if (!token) {
          return res
            .status(400)
            .json({ ok: false, message: "telegram_token_missing" });
        }

        const inlineKeyboard = payload.inlineKeyboard?.map((row) =>
          row.map((btn) => ({
            text: btn.text,
            callbackData: btn.callbackData,
          }))
        );

        if (inlineKeyboard?.length) {
          messageType = "INLINE_KEYBOARD";
          attachmentMeta = { inlineKeyboard };
        } else {
          messageType = "RICH";
          attachmentMeta = {
            buttons: payload.buttons,
            imageUrl: payload.imageUrl,
          };
        }

        delivered = await sendTelegramRich(
          token,
          session.userId,
          messageType,
          messageText,
          payload.imageUrl,
          attachmentMeta ?? undefined
        );
      } else {
        return res
          .status(400)
          .json({ ok: false, message: "unsupported_platform" });
      }

      recordDeliveryMetric(
        `${session.platform}:${bot.id}`,
        delivered,
        requestId
      );

      const msg = await prisma.chatMessage.create({
        data: {
          tenant: session.tenant,
          botId: session.botId,
          platform: session.platform,
          sessionId: session.id,
          conversationId: conversation.id,
          senderType: "admin",
          type: messageType,
          text: messageText,
          attachmentUrl: attachmentUrl,
          attachmentMeta,
          meta: { via: "admin_rich", delivered },
        },
        select: {
          id: true,
          text: true,
          type: true,
          attachmentUrl: true,
          attachmentMeta: true,
          createdAt: true,
        },
      });

      try {
        sseHub.broadcast({
          type: "chat:message:new",
          tenant: session.tenant,
          botId: session.botId,
          sessionId: session.id,
          conversationId: conversation.id,
          message: {
            id: msg.id,
            senderType: "admin",
            text: msg.text,
            type: msg.type,
            attachmentUrl: msg.attachmentUrl,
            attachmentMeta: msg.attachmentMeta,
            createdAt: msg.createdAt,
          },
        } as any);
      } catch (broadcastErr) {
        log.warn("[admin rich message] SSE broadcast warn", broadcastErr);
      }

      await prisma.chatSession.update({
        where: { id: session.id },
        data: {
          lastMessageAt: new Date(),
          lastText: msg.text,
          lastDirection: "admin",
        },
      });

      return res.json({ ok: true, delivered, messageId: msg.id });
    } catch (err: any) {
      const requestId = getRequestId(req);
      const log = createRequestLogger(requestId);
      log.error({ err, requestId }, "admin_rich_message_error");
      return res
        .status(500)
        .json({ ok: false, message: "internal_error_rich_message" });
    }
  }
);

/* ------------------------------------------------------------------ */
/* POST /api/admin/chat/sessions/:id/reply                            */
/* ------------------------------------------------------------------ */

router.post(
  "/sessions/:id/reply",
  requirePermission(["manageCampaigns"]),
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const requestId = getRequestId(req);
      const log = createRequestLogger(requestId);
      const tenant = getTenant(req);
      const sessionId = String(req.params.id);

      const parsed = replyPayloadSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ ok: false, message: "invalid_payload" });
      }

      const {
        text,
        attachmentUrl,
        attachmentMeta,
        type: rawType,
      } = parsed.data;

      const messageType: MessageType = rawType ?? "TEXT";
      const messageText = (text ?? "").trim();

      if (!messageText && !attachmentUrl) {
        return res.status(400).json({
          ok: false,
          message: "text_or_attachment_required",
        });
      }

      const fallbackText = messageText || `[${messageType.toLowerCase()}]`;

      const session = await prisma.chatSession.findFirst({
        where: { id: sessionId, tenant },
      });

      if (!session) {
        return res
          .status(404)
          .json({ ok: false, message: "chat_session_not_found" });
      }

      const bot = await prisma.bot.findUnique({
        where: { id: session.botId },
        include: { secret: true },
      });

      if (!bot) {
        return res
          .status(404)
          .json({ ok: false, message: "bot_not_found_for_session" });
      }

      const conversation = await ensureConversation({
        botId: bot.id,
        tenant: session.tenant,
        userId: session.userId,
        platform: session.platform,
        requestId,
      });

      const platform = session.platform;
      let delivered = false;

      if (platform === "telegram") {
        const token = bot.secret?.telegramBotToken;
        if (!token) {
          console.warn(
            "[admin chat reply] telegramBotToken missing for bot",
            bot.id
          );
        } else {
          try {
            delivered = await sendTelegramRich(
              token,
              session.userId,
              messageType,
              messageText,
              attachmentUrl,
              (attachmentMeta as any) ?? undefined
            );
          } catch (err) {
            console.error("[admin chat reply] telegram send error", err);
          }
        }
      } else if (platform === "line") {
        const token = bot.secret?.channelAccessToken;
        if (!token) {
          console.warn(
            "[admin chat reply] LINE channelAccessToken missing for bot",
            bot.id
          );
        } else {
          try {
            delivered = await sendLineRichMessage(
              token,
              session.userId,
              messageType,
              fallbackText,
              attachmentUrl,
              (attachmentMeta as any) ?? undefined
            );
          } catch (err) {
            console.error("[admin chat reply] line push error", err);
          }
        }
      } else {
        console.warn(
          "[admin chat reply] unsupported platform",
          platform,
          "sessionId=",
          session.id
        );
      }

      recordDeliveryMetric(`${platform}:${bot.id}`, delivered, requestId);
      log.info("[admin chat reply] delivery", {
        delivered,
        platform,
        botId: bot.id,
        sessionId: session.id,
        requestId,
      });

      const now = new Date();
      const adminMsg = await prisma.chatMessage.create({
        data: {
          tenant: session.tenant,
          botId: session.botId,
          platform: session.platform,
          sessionId: session.id,
          conversationId: conversation.id,
          senderType: "admin",
          type: messageType,
          text: messageText || "",
          attachmentUrl: attachmentUrl ?? null,
          attachmentMeta: attachmentMeta ?? null,
          meta: {
            via: "admin_reply",
            delivered,
          } as any,
        },
        select: {
          id: true,
          text: true,
          type: true,
          attachmentUrl: true,
          attachmentMeta: true,
          createdAt: true,
        },
      });

      await prisma.chatSession.update({
        where: { id: session.id },
        data: {
          lastMessageAt: now,
          lastText: messageText || fallbackText,
          lastDirection: "admin",
        },
      });

      try {
        sseHub.broadcast({
          type: "chat:message:new",
          tenant: session.tenant,
          botId: session.botId,
          sessionId: session.id,
          conversationId: conversation.id,
          message: {
            id: adminMsg.id,
            senderType: "admin",
            text: adminMsg.text,
            type: adminMsg.type,
            attachmentUrl: adminMsg.attachmentUrl,
            attachmentMeta: adminMsg.attachmentMeta,
            createdAt: adminMsg.createdAt,
          },
        } as any);
      } catch (sseErr) {
        console.warn("[admin chat reply] SSE broadcast warn", sseErr);
      }

      return res.json({
        ok: true,
        delivered,
        messageId: adminMsg.id,
      });
    } catch (err) {
      console.error("[admin chat reply] fatal error", err);
      return res
        .status(500)
        .json({ ok: false, message: "internal_error_reply" });
    }
  }
);

/* ------------------------------------------------------------------ */

export default router;
export { router as chatAdminRouter, fetchAdminChatMessages, HttpError };

