// src/services/inbound/types.ts

import type { Prisma } from "@prisma/client";

// Bot พร้อม relations ที่ pipeline ต้องใช้
export type BotWithRelations = Prisma.BotGetPayload<{
  include: {
    secret: true;
    config: { include: { preset: true } };
    intents: true;
    knowledgeLink: { include: { doc: true } };
  };
}>;

export type InboundPlatform = "line" | "telegram" | "facebook";

// อีเวนต์กลางที่ทุก platform map เข้ามา
export interface InboundEvent {
  tenant: string;
  botId: string;
  platform: InboundPlatform;

  // user identity
  userId: string;
  userName?: string;
  displayName?: string;
  userAvatar?: string;

  // main text (ถ้าไม่มี text ก็ปล่อยเป็น undefined)
  text?: string;

  // ใช้กัน duplicate ต่อ platform
  platformMessageId?: string;

  // เวลา original จาก platform
  timestamp?: Date;

  // context เฉพาะ platform
  replyToken?: string;     // LINE
  channelId?: string;      // Telegram chat_id / Facebook PSID ฯลฯ

  // raw payload เผื่อเก็บเป็น meta/case ภายหลัง
  rawPayload: unknown;
}

