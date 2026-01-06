// src/services/cases.ts
import { prisma } from "../lib/prisma";

export type CreateCaseOptions = {
  tenant: string;
  botId: string;
  platform: string;
  userId: string;
  kind: string;
  text: string;
  meta?: unknown;
};

/**
 * สร้าง CaseItem 1 เคส
 * ใช้ในที่ที่ต้องการบันทึก "เคสมีปัญหา"
 */
export async function createCase(options: CreateCaseOptions) {
  const {
    tenant,
    botId,
    platform,
    userId,
    kind,
    text,
    meta,
  } = options;

  const safeMeta = meta ?? {};

  return prisma.caseItem.create({
    data: {
      tenant,
      botId,
      platform,
      userId,
      kind,
      text,
      meta: safeMeta as any,
    },
  });
}

