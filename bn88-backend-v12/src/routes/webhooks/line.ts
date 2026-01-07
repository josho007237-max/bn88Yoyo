import { Router, type Request, type Response } from "express";
import crypto from "node:crypto";
import * as path from "node:path";
import * as fs from "node:fs/promises";

import { MessageType } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { config } from "../../config";
import {
  processIncomingMessage,
  type SupportedPlatform,
} from "../../services/inbound/processIncomingMessage";
import { createCaseWithDedupe, pendingTTL } from "../../services/cases";
import { createNotificationForCase } from "../../services/notifications";
import { createRequestLogger, getRequestId } from "../../utils/logger";
import { sseHub } from "../../lib/sseHub";
import { processActivityImageMessage } from "../../services/activity/processActivityImageMessage.js";

const router = Router();
const TENANT_DEFAULT = process.env.TENANT_DEFAULT || "bn9";

/**
 * ถ้า CaseItem.kind เป็น enum ใน Prisma:
 * - ต้องเพิ่มค่า "image_question" ใน enum แล้ว migrate
 * - ถ้ายังไม่เพิ่ม ให้เปลี่ยนตัวนี้เป็น kind ที่มีอยู่แล้วชั่วคราว
 */
const CASE_KIND_INQUIRY = "image_question";

/* ------------------------------------------------------------------ */
/* Utilities                                                          */
/* ------------------------------------------------------------------ */
export const IMAGE_CLASS = {
  ACTIVITY: "ACTIVITY",
  SLIP: "SLIP",
  OTHER: "OTHER",
  REVIEW: "REVIEW",
} as const;

export type ImageClass = (typeof IMAGE_CLASS)[keyof typeof IMAGE_CLASS];

function getChannelKeyFromSource(src?: any) {
  return src?.groupId || src?.roomId || "default";
}

function getRawBody(req: Request): Buffer | null {
  const b: unknown = (req as any).body;
  if (Buffer.isBuffer(b)) return b;
  if (typeof b === "string") return Buffer.from(b);
  return null;
}

/** Verify LINE signature (ข้ามได้เมื่อ LINE_DEV_SKIP_VERIFY=1) */
function verifyLineSignature(req: Request, channelSecret?: string): boolean {
  if (config.LINE_DEV_SKIP_VERIFY === "1") return true;

  const secret = channelSecret || config.LINE_CHANNEL_SECRET;
  const sig = req.headers["x-line-signature"];
  const raw = getRawBody(req);

  if (!secret || !sig || !raw) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(raw)
    .digest("base64");

  return expected === sig;
}

/* ------------------------------------------------------------------ */
/* LINE Types                                                         */
/* ------------------------------------------------------------------ */

type LineSource = {
  type: "user" | "group" | "room";
  userId?: string;
  groupId?: string;
  roomId?: string;
};

type LineMessage = {
  id?: string;
  type: string;
  text?: string;
  fileName?: string;
  fileSize?: number;
  packageId?: string;
  stickerId?: string;
  title?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
};

type LineEvent = {
  type: "message" | string;
  replyToken?: string;
  timestamp: number;
  source?: LineSource;
  message?: LineMessage;
};

type LineWebhookBody = {
  events?: LineEvent[];
};

/**
 * เราเก็บ URL เป็น path ใน backend ตัวเอง
 * เพื่อให้แอดมินเปิดรูป/ไฟล์ผ่าน /api/admin/chat/line-content/:id
 */
const LINE_CONTENT_BASE = "/api/admin/chat/line-content";

export type NormalizedLineMessage = {
  text: string;
  messageType: MessageType;
  attachmentUrl?: string | null;
  attachmentMeta?: Record<string, unknown> | null;
};

export function mapLineMessage(m?: LineMessage): NormalizedLineMessage | null {
  if (!m || typeof m !== "object") return null;

  const baseMeta: Record<string, unknown> = {
    lineType: m.type,
    messageId: m.id,
    fileName: m.fileName,
    fileSize: m.fileSize,
    packageId: m.packageId,
    stickerId: m.stickerId,
  };

  if (m.type === "text") {
    return {
      text: m.text ?? "",
      messageType: MessageType.TEXT,
      attachmentUrl: null,
      attachmentMeta: baseMeta,
    };
  }

  if (m.type === "image") {
    return {
      text: m.text ?? "",
      messageType: MessageType.IMAGE,
      attachmentUrl: m.id ? `${LINE_CONTENT_BASE}/${m.id}` : null,
      attachmentMeta: baseMeta,
    };
  }

  if (m.type === "file") {
    return {
      text: m.text ?? m.fileName ?? "",
      messageType: MessageType.FILE,
      attachmentUrl: m.id ? `${LINE_CONTENT_BASE}/${m.id}` : null,
      attachmentMeta: baseMeta,
    };
  }

  if (m.type === "sticker") {
    return {
      text: m.text ?? "",
      messageType: MessageType.STICKER,
      attachmentUrl: null,
      attachmentMeta: baseMeta,
    };
  }

  if (m.type === "location") {
    const lat = m.latitude;
    const lng = m.longitude;
    const locUrl =
      typeof lat === "number" && typeof lng === "number"
        ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
        : null;

    return {
      text: m.address ?? m.title ?? "location",
      messageType: MessageType.SYSTEM,
      attachmentUrl: locUrl,
      attachmentMeta: {
        ...baseMeta,
        address: m.address,
        title: m.title,
        latitude: lat,
        longitude: lng,
      },
    };
  }

  return {
    text: m.text ?? "",
    messageType: MessageType.TEXT,
    attachmentUrl: null,
    attachmentMeta: baseMeta,
  };
}

/* ------------------------------------------------------------------ */
/* Bot resolver (หา bot + secrets สำหรับ LINE)                         */
/* ------------------------------------------------------------------ */

async function resolveBot(tenant: string, botIdParam?: string) {
  let bot: { id: string; tenant: string; platform: string } | null = null;

  if (botIdParam) {
    bot = await prisma.bot.findFirst({
      where: { id: botIdParam, tenant, platform: "line" },
      select: { id: true, tenant: true, platform: true },
    });
  }

  if (!bot) {
    bot =
      (await prisma.bot.findFirst({
        where: { tenant, platform: "line", active: true },
        select: { id: true, tenant: true, platform: true },
      })) ??
      (await prisma.bot.findFirst({
        where: { tenant, platform: "line" },
        select: { id: true, tenant: true, platform: true },
      }));
  }

  if (!bot?.id) return null;

  const sec = await prisma.botSecret.findFirst({
    where: { botId: bot.id },
    select: { channelSecret: true, channelAccessToken: true },
  });

  return {
    botId: bot.id,
    tenant: bot.tenant ?? tenant,
    channelSecret: sec?.channelSecret ?? "",
    channelAccessToken: sec?.channelAccessToken ?? "",
  };
}

/* ------------------------------------------------------------------ */
/* LINE reply helper                                                  */
/* ------------------------------------------------------------------ */

async function lineReply(
  replyToken: string,
  channelAccessToken: string,
  text: string
): Promise<boolean> {
  const resp = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${channelAccessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text }],
    }),
  });

  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    console.warn("[LINE reply warning]", resp.status, t);
    return false;
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* Fetch LINE content (Buffer)                                        */
/* ------------------------------------------------------------------ */

async function fetchLineMessageContentBuffer(
  messageId: string,
  channelAccessToken: string
): Promise<{ buf: Buffer; mime: string }> {
  const resp = await fetch(
    `https://api-data.line.me/v2/bot/message/${messageId}/content`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${channelAccessToken}` },
    }
  );

  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    throw new Error(
      `LINE content fetch failed: ${resp.status} ${resp.statusText} ${t}`
    );
  }

  const mime = resp.headers.get("content-type") || "application/octet-stream";
  const ab = await resp.arrayBuffer();
  return { buf: Buffer.from(ab), mime };
}

/* ------------------------------------------------------------------ */
/* Save image to /uploads and return public URL                       */
/* ------------------------------------------------------------------ */

async function saveIncomingImageToUploads(params: {
  tenant: string;
  messageId: string;
  buf: Buffer;
  mime: string;
}): Promise<string> {
  const { tenant, messageId, buf, mime } = params;

  const ext = mime.includes("png")
    ? "png"
    : mime.includes("webp")
      ? "webp"
      : "jpg";

  const dir = path.join(process.cwd(), "uploads", "line", tenant);
  await fs.mkdir(dir, { recursive: true });

  const filename = `${Date.now()}_${messageId}.${ext}`;
  const fullpath = path.join(dir, filename);

  await fs.writeFile(fullpath, buf);
  return `/uploads/line/${tenant}/${filename}`;
}

/* ------------------------------------------------------------------ */
/* Vision classify (OpenAI)                                           */
/* ------------------------------------------------------------------ */

type VisionResult = { classification: ImageClass; confidence: number };

function clamp01(n: number) {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

async function classifyImageBuffer(
  buf: Buffer,
  mime: string
): Promise<VisionResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { classification: IMAGE_CLASS.OTHER, confidence: 0 };

  const model = process.env.OPENAI_VISION_MODEL || "gpt-4o-mini";
  const b64 = buf.toString("base64");

  const prompt =
    "คุณคือระบบคัดแยกรูปจากแชทลูกค้า ให้ตอบเป็น JSON บรรทัดเดียวเท่านั้น:\n" +
    `{"classification":"SLIP|ACTIVITY|OTHER","confidence":0-1}\n` +
    "ความหมาย:\n" +
    "- SLIP = สลิป/หลักฐานโอนเงิน/ใบเสร็จธนาคาร\n" +
    "- ACTIVITY = รูปส่งกิจกรรม/หลักฐานแชร์/คอมเมนต์/โพสต์/สตอรี่/หน้าจอทำภารกิจ\n" +
    "- OTHER = อย่างอื่น (โปสเตอร์โปรโมชัน, มีม, รูปทั่วไป)\n" +
    "ห้ามใส่ข้อความอื่นนอกจาก JSON";

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 80,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: { url: `data:${mime};base64,${b64}` },
            },
          ],
        },
      ],
    }),
  });

  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    console.warn("[VISION] OpenAI error", resp.status, t);
    return { classification: IMAGE_CLASS.OTHER, confidence: 0 };
  }

  const json = (await resp.json().catch(() => null)) as any;
  const raw = String(json?.choices?.[0]?.message?.content ?? "").trim();

  try {
    const parsed = JSON.parse(raw);
    const cls = String(parsed?.classification ?? "")
      .trim()
      .toUpperCase();
    const conf = clamp01(Number(parsed?.confidence ?? 0));

    if (cls === "SLIP")
      return { classification: IMAGE_CLASS.SLIP, confidence: conf };
    if (cls === "ACTIVITY")
      return { classification: IMAGE_CLASS.ACTIVITY, confidence: conf };
    return { classification: IMAGE_CLASS.OTHER, confidence: conf };
  } catch {
    const up = raw.toUpperCase();
    if (up.includes("SLIP"))
      return { classification: IMAGE_CLASS.SLIP, confidence: 0.7 };
    if (up.includes("ACTIVITY"))
      return { classification: IMAGE_CLASS.ACTIVITY, confidence: 0.7 };
    return { classification: IMAGE_CLASS.OTHER, confidence: 0.4 };
  }
}

/* ------------------------------------------------------------------ */
/* POST /api/webhooks/line?botId=...                                  */
/* ------------------------------------------------------------------ */

router.post("/", async (req: Request, res: Response) => {
  const requestId = getRequestId(req);
  const log = createRequestLogger(requestId);
  type PendingImageKind = "activity" | "image_question";

  try {
    const tenantHeader =
      (req.headers["x-tenant"] as string) ||
      config.TENANT_DEFAULT ||
      TENANT_DEFAULT;

    const botIdParam =
      typeof req.query.botId === "string"
        ? (req.query.botId as string)
        : undefined;

    const picked = await resolveBot(tenantHeader, botIdParam);
    if (!picked) {
      log.error("[LINE webhook] bot not configured for tenant", tenantHeader);
      return res
        .status(400)
        .json({ ok: false, message: "line_bot_not_configured" });
    }

    const { botId, tenant, channelSecret, channelAccessToken } = picked;

    if (!verifyLineSignature(req, channelSecret)) {
      log.warn("[LINE webhook] invalid signature");
      return res.status(401).json({ ok: false, message: "invalid_signature" });
    }

    let payload: LineWebhookBody | null = (req as any).body;

    if (Buffer.isBuffer(payload as any)) {
      try {
        payload = JSON.parse((payload as any).toString("utf8"));
      } catch {
        payload = null;
      }
    }

    const events: LineEvent[] = Array.isArray(payload?.events)
      ? payload!.events!
      : [];
    if (!events.length)
      return res.status(200).json({ ok: true, noEvents: true });

    const isRetry = Boolean(req.headers["x-line-retry-key"]);
    const platform: SupportedPlatform = "line";
    const results: Array<Record<string, unknown>> = [];

    for (const ev of events) {
      try {
        if (ev.type !== "message" || !ev.message) {
          results.push({ skipped: true, reason: "not_message" });
          continue;
        }

        const mapped = mapLineMessage(ev.message as LineMessage);
        if (!mapped) {
          results.push({ skipped: true, reason: "unsupported_message" });
          continue;
        }

        const now = Date.now();
        const PENDING_TTL_MS = 12 * 60 * 60 * 1000;

        const channelKey = getChannelKeyFromSource(ev.source);
        const userId =
          ev.source?.userId ||
          ev.source?.groupId ||
          ev.source?.roomId ||
          "unknown";
        const displayName =
          ev.source?.userId || ev.source?.groupId || ev.source?.roomId;

        const platformMessageId = (ev.message as LineMessage).id ?? undefined;
        const text = mapped.text || "";

        const { reply, intent, isIssue } = await processIncomingMessage({
          botId,
          platform,
          userId,
          text,
          messageType: mapped.messageType,
          attachmentUrl: mapped.attachmentUrl ?? undefined,
          attachmentMeta: mapped.attachmentMeta ?? undefined,
          displayName,
          platformMessageId,
          rawPayload: ev,
          requestId,
        });

        const t = tenant || TENANT_DEFAULT;

        // session ล่าสุด
        const session = await prisma.chatSession.findFirst({
          where: { botId, platform, userId, tenant: t },
          orderBy: { createdAt: "desc" },
        });

        const lastMsg = session
          ? await prisma.chatMessage.findFirst({
              where: { sessionId: session.id },
              orderBy: { createdAt: "desc" },
            })
          : null;

        let finalReply = reply;

        // -------------------- อ่าน meta + TTL เคลียร์ pending --------------------
        let sessionMeta: any = (session?.meta as any) ?? {};
        let pendingKindLocal: string | null =
          sessionMeta.pendingImageKind ?? null;
        const pendingAt = Number(sessionMeta.pendingAt ?? 0);

        const pendingExpired =
          !!pendingKindLocal && pendingTTL(pendingAt, PENDING_TTL_MS);

        if (session?.id && pendingExpired) {
          await prisma.chatSession.update({
            where: { id: session.id },
            data: {
              meta: {
                ...sessionMeta,
                pendingImageKind: null,
                pendingAt: null,
                pendingText: null,
              } as any,
            } as any,
          });

          sessionMeta = {
            ...sessionMeta,
            pendingImageKind: null,
            pendingAt: null,
            pendingText: null,
          };
          pendingKindLocal = null;
        }

        // -------------------- TEXT FLAGS --------------------
        const wantsActivityText = /ส่งกิจกรรม|กิจกรรม/i.test(text || "");
        const wantsImageQuestionText =
          /โปร|โปรโมชั่น|โบนัส|เว็บ|หน้าเว็บ|ตามรูป|ตามภาพ|รูปนี้|ภาพนี้|\?/i.test(
            text || ""
          );

        // 1) ส่งกิจกรรม -> ตั้งโหมด activity
        if (wantsActivityText && session?.id) {
          await prisma.chatSession.update({
            where: { id: session.id },
            data: {
              meta: {
                ...(((session.meta as any) ?? {}) as any),
                pendingImageKind: "activity",
                pendingAt: now,
                pendingText: text || "",
              } as any,
            } as any,
          });

          pendingKindLocal = "activity";
          finalReply = "ได้เลยค่ะ ส่งรูปหลักฐานกิจกรรมมาได้เลยนะคะ";
        }

        // 2) ถามจากรูป/โปร/หน้าเว็บ -> ตั้งโหมด image_question (ถ้าไม่ใช่ activity)
        if (!wantsActivityText && wantsImageQuestionText && session?.id) {
          await prisma.chatSession.update({
            where: { id: session.id },
            data: {
              meta: {
                ...(((session.meta as any) ?? {}) as any),
                pendingImageKind: "image_question",
                pendingAt: now,
                pendingText: text || "",
              } as any,
            } as any,
          });

          pendingKindLocal = "image_question";
          // ไม่ต้องฝืนตอบยาว แค่ชวนส่งรูป/หรือถ้าส่งรูปแล้วให้พิมพ์ต่อ
          finalReply =
            "ได้เลยค่ะ ถ้าสะดวกส่งรูปประกอบ แล้วพิมพ์คำถามตามมาได้เลยนะคะ";
        }

        // 3) ส่งรูปก่อน แล้วค่อยพิมพ์ถาม -> สร้างเคส inquiry จาก lastImageUrl (ภายใน 10 นาที)
        if (mapped.messageType === MessageType.TEXT && session?.id) {
          const lastImageUrl =
            (sessionMeta?.lastImageUrl as string | undefined) ?? undefined;
          const lastImageAt = Number(sessionMeta?.lastImageAt ?? 0);
          const hasRecentImage =
            !!lastImageUrl && now - lastImageAt < 10 * 60 * 1000;

          if (!wantsActivityText && wantsImageQuestionText && hasRecentImage) {
            const inquiryCase = await prisma.caseItem.create({
              data: {
                tenant: t,
                botId,
                platform,
                sessionId: session.id,
                userId,
                kind: CASE_KIND_INQUIRY as any,
                text: text || "",
                meta: {
                  imageUrl: lastImageUrl,
                  note: "question_after_image",
                } as any,
              } as any,
            });

            await createNotificationForCase({
              id: inquiryCase.id,
              tenant: t,
              botId,
              kind: inquiryCase.kind,
              userId,
              text: inquiryCase.text,
              meta: inquiryCase.meta,
            });

            sseHub.broadcast({
              tenant: t,
              type: "case:new",
              data: {
                caseId: inquiryCase.id,
                kind: inquiryCase.kind,
                botId,
                sessionId: session.id,
              },
            });

            await prisma.chatSession.update({
              where: { id: session.id },
              data: {
                meta: {
                  ...(((session.meta as any) ?? {}) as any),
                  lastImageUrl: null,
                  lastImageAt: null,
                } as any,
              } as any,
            });

            finalReply =
              "รับคำถามแล้วค่ะ เดี๋ยวแอดมินช่วยเช็คจากรูปให้นะคะ ถ้ามีจุดที่อยากให้ดูเป็นพิเศษ บอกเพิ่มได้เลยค่ะ";
          }
        }

        // ===================== IMAGE FLOW =====================
        if (
          mapped.messageType === MessageType.IMAGE &&
          platformMessageId &&
          channelAccessToken &&
          session
        ) {
          try {
            const { buf, mime } = await fetchLineMessageContentBuffer(
              platformMessageId,
              channelAccessToken
            );

            const cls = await classifyImageBuffer(buf, mime);

            const publicImageUrl = await saveIncomingImageToUploads({
              tenant: t,
              messageId: platformMessageId,
              buf,
              mime,
            });

            // อ่านธงจากตัวแปร local (ผ่าน TTL แล้ว)
            const userWantsActivity = pendingKindLocal === "activity";
            const userWantsInquiry = pendingKindLocal === "image_question";

            // ถ้าอยู่โหมดกิจกรรม/ถามจากรูป แล้ว AI ดันตีเป็น SLIP -> REVIEW กันไหลผิดทาง
            const effectiveCls: VisionResult =
              (userWantsActivity || userWantsInquiry) &&
              cls.classification === IMAGE_CLASS.SLIP
                ? {
                    classification: IMAGE_CLASS.REVIEW,
                    confidence: Math.min(cls.confidence, 0.6),
                  }
                : cls;

            // กัน REVIEW ชน enum DB (ImageIntake)
            const dbCls: ImageClass =
              effectiveCls.classification === IMAGE_CLASS.REVIEW
                ? IMAGE_CLASS.OTHER
                : effectiveCls.classification;

            // ---- คุม pending หลังประมวลผลรูป ----
            let nextPendingKind: PendingImageKind | null =
              pendingKindLocal === "activity" ||
              pendingKindLocal === "image_question"
                ? (pendingKindLocal as PendingImageKind)
                : null;

            if (userWantsActivity) {
              // โหมดกิจกรรม: ถ้ายังไม่ ACTIVITY ให้ค้างโหมดไว้
              nextPendingKind =
                effectiveCls.classification === IMAGE_CLASS.ACTIVITY
                  ? null
                  : "activity";
            } else {
              // ไม่ใช่กิจกรรม:
              // - รูป OTHER => เข้าโหมดถามจากรูป เพื่อให้พิมพ์คำถามต่อ
              // - สลิปจริง => ไม่ต้องค้างโหมด
              if (dbCls === IMAGE_CLASS.OTHER)
                nextPendingKind = "image_question";
              if (dbCls === IMAGE_CLASS.SLIP) nextPendingKind = null;
            }

            // เก็บ lastImage ไว้เสมอ + อัปเดต pendingKind
            await prisma.chatSession.update({
              where: { id: session.id },
              data: {
                meta: {
                  ...(((session.meta as any) ?? {}) as any),
                  lastImageUrl: publicImageUrl,
                  lastImageAt: Date.now(),
                  pendingImageKind: nextPendingKind,
                  // อย่าลืมเก็บเวลาไว้ด้วย (ใช้ TTL)
                  pendingAt: nextPendingKind ? Date.now() : null,
                } as any,
              } as any,
            });

            const intake = await prisma.imageIntake.create({
              data: {
                tenant: t,
                botId,
                platform,
                channelKey,
                userId,
                sessionId: session.id,
                chatMessageId: lastMsg?.id ?? null,
                imageUrl: publicImageUrl,
                classification: dbCls as any,
                confidence: effectiveCls.confidence,
              } as any,
            });

            // ✅ สร้างเคส “เฉพาะที่ควรให้แอดมินเห็น”
            let caseItem: any = null;

            const shouldCreateCase =
              dbCls === IMAGE_CLASS.SLIP ||
              userWantsActivity ||
              effectiveCls.classification === IMAGE_CLASS.ACTIVITY ||
              effectiveCls.classification === IMAGE_CLASS.REVIEW;

            // ไม่ใช่กิจกรรม + รูป OTHER => ยังไม่สร้างเคส (รอ user พิมพ์คำถาม)
            if (
              shouldCreateCase &&
              (dbCls !== IMAGE_CLASS.OTHER || userWantsActivity)
            ) {
              const kind =
                dbCls === IMAGE_CLASS.SLIP
                  ? ("deposit_slip" as any)
                  : ("activity" as any);

              const { caseItem: savedCase, created } = await createCaseWithDedupe({
                tenant: t,
                botId,
                platform,
                sessionId: session.id,
                userId,
                kind,
                text: "[image]",
                meta: {
                  classification: effectiveCls.classification, // REVIEW เก็บได้ใน meta
                  confidence: effectiveCls.confidence,
                  lineMessageId: platformMessageId,
                  imageUrl: publicImageUrl,
                  originalClassification: cls.classification,
                  originalConfidence: cls.confidence,
                } as any,
                imageIntakeId: intake.id,
                dedupeWindowMs: 15 * 60 * 1000,
                noteVia: "image",
                attachmentUrl: publicImageUrl,
                noteMeta: {
                  classification: effectiveCls.classification,
                  confidence: effectiveCls.confidence,
                } as any,
              });

              caseItem = savedCase;

              sseHub.broadcast({
                tenant: t,
                type: created ? "case:new" : "case:update",
                data: created
                  ? {
                      caseId: savedCase.id,
                      kind: savedCase.kind,
                      botId,
                      sessionId: session.id,
                    }
                  : {
                      caseId: savedCase.id,
                      kind: savedCase.kind,
                      botId,
                      sessionId: session.id,
                      status: savedCase.status,
                      updatedAt: savedCase.updatedAt,
                    },
              });
            }

            // ✅ ข้อความตอบกลับรูป (ทับเสมอ)
            if (dbCls === IMAGE_CLASS.SLIP) {
              finalReply =
                "รับรูปสลิปแล้วนะคะ กำลังตรวจสอบให้ค่ะ ถ้าสะดวกฝาก USER/ยอด/เวลาโอน เพิ่มเติมได้เลยนะคะ";
            } else if (userWantsActivity) {
              if (effectiveCls.classification === IMAGE_CLASS.ACTIVITY) {
                finalReply =
                  "รับรูปกิจกรรมแล้วนะคะ เดี๋ยวตรวจสอบให้ค่ะ ถ้าต้องการข้อมูลเพิ่ม พี่จะแจ้งทันทีค่ะ";
              } else if (effectiveCls.classification === IMAGE_CLASS.REVIEW) {
                finalReply =
                  "รับรูปแล้วนะคะ แต่ระบบยังไม่ชัวร์ว่าเป็น “กิจกรรม” รบกวนส่งรูปที่เห็นหลักฐานกิจกรรมชัดๆ (หน้าจอแชร์/คอมเมนต์/โพสต์/สตอรี่) อีกครั้งได้ไหมคะ";
              } else {
                finalReply =
                  "รูปนี้ยังไม่ใช่หลักฐานกิจกรรมค่ะ รบกวนส่งรูปกิจกรรม/ภารกิจที่ชัดเจนอีกครั้งนะคะ";
              }
            } else {
              // ไม่ใช่กิจกรรม -> โหมดถามจากรูป
              finalReply =
                "รับรูปแล้วค่ะ ถ้าต้องการสอบถามจากรูป รบกวนพิมพ์คำถามเพิ่มนิดนึงนะคะ";
            }

            // ✅ ส่งเข้า pipeline เฉพาะ “โหมดกิจกรรม + AI มั่นใจว่า ACTIVITY”
            if (
              userWantsActivity &&
              effectiveCls.classification === IMAGE_CLASS.ACTIVITY
            ) {
              try {
                const bot = { id: botId, tenant: t, platform: "line" };
                const r = await processActivityImageMessage({
                  bot,
                  tenant: t,
                  botId,
                  platform: "line",
                  userId,
                  sessionId: session.id,
                  attachmentUrl: publicImageUrl,
                  captionText: "ส่งกิจกรรม",
                  requestId,
                  imageIntakeId: intake.id,
                  caseId: caseItem?.id,
                } as any);

                if (r?.reply) finalReply = String(r.reply);
              } catch (pipeErr) {
                log.error("[LINE webhook] activity pipeline error", pipeErr);
              }
            }
          } catch (imgErr) {
            log.error("[LINE webhook] image classify error", imgErr);
            finalReply =
              finalReply ||
              "รับรูปแล้วค่ะ แต่ตอนนี้ระบบตรวจรูปขัดข้อง เดี๋ยวแอดมินช่วยตรวจให้นะคะ";
          }
        }
        // =================== END IMAGE FLOW ===================

        // SSE broadcast แชทใหม่ (Chat Center)
        try {
          if (session && lastMsg) {
            sseHub.broadcast({
              tenant: t,
              type: "chat:message:new",
              data: {
                platform: "line",
                botId,
                sessionId: session.id,
                messageId: lastMsg.id,
              },
            });
          }
        } catch (broadcastErr) {
          log.error("[LINE webhook] SSE broadcast error", broadcastErr);
        }

        // ตอบ LINE (ยกเว้น retry)
        let replySent = false;
        if (!isRetry && ev.replyToken && channelAccessToken && finalReply) {
          replySent = await lineReply(
            ev.replyToken,
            channelAccessToken,
            finalReply
          ).catch(() => false);
        }

        results.push({ ok: true, replied: replySent, intent, isIssue });
      } catch (evErr) {
        log.error("[LINE webhook event error]", evErr);
        results.push({ ok: false, error: true });
      }
    }

    return res.status(200).json({
      ok: true,
      results,
      retry: isRetry,
      tenant: picked.tenant,
      requestId,
    });
  } catch (e) {
    log.error("[LINE WEBHOOK ERROR]", e);
    return res.status(500).json({ ok: false, message: "internal_error" });
  }
});

export default router;
export { router as lineWebhookRouter };
