// src/services/line/handleLineMessageEvent.ts
import axios from "axios";
import { Buffer } from "buffer";
import { prisma } from "../../lib/prisma";
import {
  processIncomingMessage,
  type ProcessIncomingResult,
} from "../inbound/processIncomingMessage";
import { intakeActivityFromImage } from "../activity/intakeActivityFromImage";

/* ------------------------------------------------------------------ */
/* Types พื้นฐานสำหรับ LINE Webhook                                   */
/* ------------------------------------------------------------------ */

type LineTextMessage = {
  type: "text";
  id: string;
  text: string;
};

type LineImageMessage = {
  type: "image";
  id: string;
};

type LineUnknownMessage = {
  type: string;
  id?: string;
  [k: string]: any;
};

type LineSource = {
  type: "user" | "group" | "room";
  userId?: string;
  groupId?: string;
  roomId?: string;
};

type LineMessageEvent = {
  type: "message";
  mode: "active" | "standby";
  timestamp: number;
  replyToken: string;
  source: LineSource;
  message: LineTextMessage | LineImageMessage | LineUnknownMessage;
};

export type LineWebhookEvent = LineMessageEvent;

/* ------------------------------------------------------------------ */
/* Helper: reply text to LINE                                          */
/* ------------------------------------------------------------------ */

async function replyTextToLine(
  channelAccessToken: string,
  replyToken: string,
  text: string
) {
  await axios.post(
    "https://api.line.me/v2/bot/message/reply",
    {
      replyToken,
      messages: [{ type: "text", text }],
    },
    {
      headers: {
        Authorization: `Bearer ${channelAccessToken}`,
        "Content-Type": "application/json",
      },
    }
  );
}

/* ------------------------------------------------------------------ */
/* Helper: download LINE message content (image)                       */
/* ------------------------------------------------------------------ */

async function downloadLineMessageContent(
  channelAccessToken: string,
  messageId: string
): Promise<{ dataUrl: string; contentType: string }> {
  const url = `https://api-data.line.me/v2/bot/message/${encodeURIComponent(
    messageId
  )}/content`;

  const resp = await axios.get(url, { responseType: "arraybuffer" as const });
  const data = resp.data as ArrayBuffer;

  const contentType =
    (resp.headers?.["content-type"] as string) || "image/jpeg";

  const b64 = Buffer.from(resp.data).toString("base64");
  const dataUrl = `data:${contentType};base64,${b64}`;

  return { dataUrl, contentType };
}

/* ------------------------------------------------------------------ */
/* ฟังก์ชันหลัก: handleLineMessageEvent                               */
/* ------------------------------------------------------------------ */

export async function handleLineMessageEvent(
  botId: string,
  event: LineWebhookEvent
): Promise<void> {
  if (event.type !== "message") return;
  if (!event.message) return;

  const replyToken = event.replyToken;
  const userSource = event.source;

  const userId =
    userSource.userId || userSource.groupId || userSource.roomId || "unknown";

  try {
    // โหลด bot + secret เพื่อใช้ยิงกลับ LINE
    const bot = await prisma.bot.findUnique({
      where: { id: botId },
      include: { secret: true },
    });

    if (!bot) {
      console.warn("[line-webhook] Bot not found:", botId);
      return;
    }

    if (!bot.secret || !bot.secret.channelAccessToken) {
      console.warn("[line-webhook] Missing channelAccessToken for bot:", botId);
      return;
    }

    const channelAccessToken = bot.secret.channelAccessToken;

    // ---------- TEXT ----------
    if (event.message.type === "text") {
      const text = (event.message.text || "").trim();
      if (!text) return;

      // ให้สมองกลางจัดการ (AI, Case, Stat, ChatSession/Message)
      const result: ProcessIncomingResult = await processIncomingMessage({
        botId: bot.id,
        platform: "line",
        userId,
        text,
      });

      const replyText = result.reply || "ขอบคุณสำหรับข้อความค่ะ (LINE default)";

      try {
        await replyTextToLine(channelAccessToken, replyToken, replyText);
      } catch (err) {
        console.error(
          "[line-webhook] error while calling LINE reply (text)",
          (err as any)?.message ?? err
        );
      }
      return;
    }

    // ---------- IMAGE ----------
    if (event.message.type === "image") {
      const messageId = event.message.id;

      try {
        // 1) download image from LINE -> dataUrl (base64)
        const { dataUrl } = await downloadLineMessageContent(
          channelAccessToken,
          messageId
        );

        // 2) intake -> create CaseItem if ACTIVITY
        const out = await intakeActivityFromImage({
          tenant: bot.tenant,
          botId: bot.id,
          platform: "line",
          channelKey: bot.id,
          userId,
          messageId,
          imageDataUrl: dataUrl,
        });

        const replyText =
          out?.reply || "รับรูปเรียบร้อยค่ะ กำลังตรวจสอบให้ รอสักครู่นะคะ";

        await replyTextToLine(channelAccessToken, replyToken, replyText);
      } catch (err: any) {
        console.error(
          "[line-webhook] image intake error",
          err?.response?.data || err?.message || err
        );

        try {
          await replyTextToLine(
            channelAccessToken,
            replyToken,
            "รับรูปแล้วค่ะ แต่ระบบประมวลผลไม่สำเร็จ รบกวนส่งใหม่อีกครั้งนะคะ"
          );
        } catch {}
      }

      return;
    }

    // ---------- OTHER MESSAGE TYPES ----------
    return;
  } catch (err) {
    console.error(
      "[line-webhook] handleLineMessageEvent fatal error",
      (err as any)?.message ?? err
    );
  }
}

