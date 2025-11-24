// src/services/line/reply.ts

import type { BotWithRelations } from "../inbound/types";

export async function sendLineReply(args: {
  bot: BotWithRelations;
  replyToken?: string;
  toUserId?: string;
  text: string;
}) {
  const { bot, replyToken, toUserId, text } = args;

  console.log("[line:reply] stub send", {
    botId: bot.id,
    replyToken,
    toUserId,
    text,
  });

  // TODO: ย้าย logic CALL LINE Messaging API เดิมของคุณมาไว้ที่นี่
  // - ใช้ bot.secret.channelAccessToken
  // - ถ้ามี replyToken ให้ใช้ /message/reply
  // - ถ้าเป็นกรณี push จาก admin ให้ใช้ /message/push กับ toUserId
}
