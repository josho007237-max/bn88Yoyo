// src/services/line/mapLineEventToInbound.ts

import type { InboundEvent } from "../inbound/types";

/**
 * แปลง LINE message event ให้กลายเป็น InboundEvent กลาง
 */
export function mapLineEventToInbound(args: {
  tenant: string;
  botId: string;
  event: any; // ใช้ any ไปก่อนเพื่อให้ยืดหยุ่นกับเวอร์ชัน SDK ปัจจุบัน
}): InboundEvent {
  const { tenant, botId, event } = args;

  const message = event.message ?? {};
  const text =
    message.type === "text" && typeof message.text === "string"
      ? message.text
      : undefined;

  const source = event.source ?? {};
  const userId =
    source.userId ??
    source.senderId ??
    source.mid ?? // เผื่อกรณี legacy
    "unknown";

  const platformMessageId =
    typeof message.id === "string" ? message.id : undefined;

  const timestamp =
    typeof event.timestamp === "number"
      ? new Date(event.timestamp)
      : new Date();

  const replyToken =
    typeof event.replyToken === "string" ? event.replyToken : undefined;

  return {
    tenant,
    botId,
    platform: "line",
    userId,
    text,
    rawPayload: event,
    platformMessageId,
    timestamp,
    replyToken,
  };
}

