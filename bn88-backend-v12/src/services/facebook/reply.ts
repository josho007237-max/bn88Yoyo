// src/services/facebook/reply.ts

import type { BotWithRelations } from "../inbound/types";

export async function sendFacebookReply(args: {
  bot: BotWithRelations;
  toUserId: string;
  text: string;
}) {
  const { bot, toUserId, text } = args;

  console.log("[facebook:reply] stub send", {
    botId: bot.id,
    toUserId,
    text,
  });

  // TODO: ย้าย logic CALL Facebook Graph API เดิมของคุณมาไว้ที่นี่
  // - ใช้ bot.secret.facebookPageAccessToken
  // - POST ไป /me/messages พร้อม recipient.id = toUserId
}

