// src/services/telegram/reply.ts

import type { BotWithRelations } from "../inbound/types";

export async function sendTelegramMessage(args: {
  bot: BotWithRelations;
  chatId: string;
  text: string;
}) {
  const { bot, chatId, text } = args;

  console.log("[telegram:reply] stub send", {
    botId: bot.id,
    chatId,
    text,
  });

  // TODO: ย้าย logic CALL Telegram Bot API เดิมของคุณมาไว้ที่นี่
  // เช่น POST ไปที่ https://api.telegram.org/bot<TOKEN>/sendMessage
  // โดยใช้ bot.secret.telegramBotToken
}
