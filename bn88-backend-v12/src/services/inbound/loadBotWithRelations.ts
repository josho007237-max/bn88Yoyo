// src/services/inbound/loadBotWithRelations.ts

import { prisma } from "../../lib/prisma";
import type { BotWithRelations } from "./types";

/**
 * โหลด Bot พร้อม relations ที่จำเป็นสำหรับ inbound pipeline
 * ถ้า tenant ถูกระบุ จะ check ให้ตรงด้วย (กันยิง cross-tenant)
 */
export async function loadBotWithRelations(
  botId: string,
  tenant?: string
): Promise<BotWithRelations | null> {
  if (!botId) return null;

  const bot = await prisma.bot.findUnique({
    where: { id: botId },
    include: {
      secret: true,
      config: { include: { preset: true } },
      intents: true,
      knowledgeLink: { include: { doc: true } },
    },
  });

  if (!bot) return null;
  if (tenant && bot.tenant !== tenant) return null;

  return bot;
}
