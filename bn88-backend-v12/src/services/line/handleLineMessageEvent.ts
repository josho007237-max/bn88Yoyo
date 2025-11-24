// src/services/line/handleLineMessageEvent.ts
import axios from "axios";
import { prisma } from "../../lib/prisma";
import {
  processIncomingMessage,
  type ProcessIncomingResult,
} from "../inbound/processIncomingMessage";

/* ------------------------------------------------------------------ */
/* Types พื้นฐานสำหรับ LINE Webhook                                   */
/* ------------------------------------------------------------------ */

type LineTextMessage = {
  type: "text";
  id: string;
  text: string;
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
  message: LineTextMessage | any;
};

export type LineWebhookEvent = LineMessageEvent;

/* ------------------------------------------------------------------ */
/* ฟังก์ชันหลัก: handleLineMessageEvent                               */
/* ------------------------------------------------------------------ */

export async function handleLineMessageEvent(
  botId: string,
  event: LineWebhookEvent
): Promise<void> {
  // รองรับเฉพาะข้อความ text
  if (event.type !== "message") return;
  if (!event.message || event.message.type !== "text") return;

  const text = (event.message.text || "").trim();
  if (!text) return;

  const replyToken = event.replyToken;
  const userSource = event.source;

  const userId =
    userSource.userId ||
    userSource.groupId ||
    userSource.roomId ||
    "unknown";

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
      console.warn(
        "[line-webhook] Missing channelAccessToken for bot:",
        botId
      );
      return;
    }

    // ให้สมองกลางจัดการ (AI, Case, Stat, ChatSession/Message)
    const result: ProcessIncomingResult = await processIncomingMessage({
      botId: bot.id,
      platform: "line",
      userId,
      text,
    });

    const replyText =
      result.reply || "ขอบคุณสำหรับข้อความค่ะ (LINE default)";

    // ส่งข้อความตอบกลับหา LINE
    const channelAccessToken = bot.secret.channelAccessToken;

    try {
      await axios.post(
        "https://api.line.me/v2/bot/message/reply",
        {
          replyToken,
          messages: [
            {
              type: "text",
              text: replyText,
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${channelAccessToken}`,
            "Content-Type": "application/json",
          },
        }
      );
    } catch (err) {
      console.error(
        "[line-webhook] error while calling LINE reply",
        (err as any)?.message ?? err
      );
    }
  } catch (err) {
    // กัน error เฉพาะฝั่ง LINE แยกจาก platform อื่น
    console.error(
      "[line-webhook] handleLineMessageEvent fatal error",
      (err as any)?.message ?? err
    );
  }
}
