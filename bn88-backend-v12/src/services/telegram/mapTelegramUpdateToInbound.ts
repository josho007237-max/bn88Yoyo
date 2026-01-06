// src/services/telegram/mapTelegramUpdateToInbound.ts

import type { InboundEvent } from "../inbound/types";

export function mapTelegramUpdateToInbound(args: {
  tenant: string;
  botId: string;
  update: any;
}): InboundEvent {
  const { tenant, botId, update } = args;
  const message = update.message ?? {};
  const from = message.from ?? {};
  const chat = message.chat ?? {};

  const userId = String(from.id ?? chat.id ?? "unknown");
  const text =
    typeof message.text === "string" ? (message.text as string) : undefined;

  const platformMessageId =
    typeof message.message_id !== "undefined"
      ? String(message.message_id)
      : undefined;

  const timestamp =
    typeof message.date === "number"
      ? new Date(message.date * 1000)
      : new Date();

  return {
    tenant,
    botId,
    platform: "telegram",
    userId,
    text,
    rawPayload: update,
    platformMessageId,
    timestamp,
    channelId: chat ? String(chat.id) : undefined,
  };
}

