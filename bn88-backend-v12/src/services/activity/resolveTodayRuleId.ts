// src/services/activity/resolveTodayRuleId.ts
import { prisma } from "../../lib/prisma";

function dateKeyBangkok(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now); // YYYY-MM-DD
}

export async function resolveTodayRuleId(params: {
  tenant: string;
  botId: string;
  dateKey?: string;
}): Promise<{ ruleId: string; dateKey: string }> {
  const dateKey = params.dateKey ?? dateKeyBangkok();

  // ✅ จุดเดียวที่อาจต้องแก้: ชื่อ field ของ DailyRule
  // ถ้า schema พี่ไม่ใช่ dateKey / isActive ให้แก้ where ตรงนี้ให้ตรงของจริง
  const rule = await prisma.dailyRule.findFirst({
    where: {
      tenant: params.tenant,
      botId: params.botId,
      dateKey,
      isActive: true,
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  if (!rule?.id) {
    throw new Error(
      `DAILY_RULE_NOT_FOUND:${params.tenant}:${params.botId}:${dateKey}`
    );
  }

  return { ruleId: rule.id, dateKey };
}
