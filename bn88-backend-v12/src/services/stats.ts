// src/services/stats.ts
import { prisma } from "../lib/prisma";
import type { StatDaily } from "@prisma/client";

/** คืนค่า dateKey ของวันนี้ในรูปแบบ YYYY-MM-DD (UTC) */
export const todayKey = (): string => new Date().toISOString().slice(0, 10);

/** helper: ดึง tenant จาก botId (ใช้ตอนต้อง create StatDaily แถวใหม่) */
async function getBotTenant(botId: string): Promise<string> {
  const bot = await prisma.bot.findUnique({
    where: { id: botId },
    select: { tenant: true },
  });

  if (!bot) {
    throw new Error(`bot_not_found_for_stats: ${botId}`);
  }

  return bot.tenant;
}

/** ดึงสถิติของวัน (ถ้าไม่ระบุ dateKey จะดึงของวันนี้) */
export async function findStatDaily(
  botId: string,
  dateKey?: string
): Promise<StatDaily | null> {
  if (!botId) throw new Error("missing botId");
  const key = dateKey ?? todayKey();
  return prisma.statDaily.findUnique({
    where: { botId_dateKey: { botId, dateKey: key } },
  });
}

/** สร้างแถว StatDaily ใหม่ (ใช้ตอน seed/กรณีพิเศษ) */
type StatFields =
  | "total"
  | "text"
  | "follow"
  | "unfollow"
  | "messageIn"
  | "messageOut"
  | "casesNew"
  | "casesResolved";

type StatPartial = Partial<Pick<StatDaily, StatFields>>;

export async function createStatDaily(
  botId: string,
  dateKey?: string,
  initial?: StatPartial
): Promise<StatDaily> {
  if (!botId) throw new Error("missing botId");
  const key = dateKey ?? todayKey();
  const tenant = await getBotTenant(botId);

  return prisma.statDaily.create({
    data: {
      bot: { connect: { id: botId } },
      tenant,
      dateKey: key,
      total: initial?.total ?? 0,
      text: initial?.text ?? 0,
      follow: initial?.follow ?? 0,
      unfollow: initial?.unfollow ?? 0,
      messageIn: initial?.messageIn ?? 0,
      messageOut: initial?.messageOut ?? 0,
      casesNew: initial?.casesNew ?? 0,
      casesResolved: initial?.casesResolved ?? 0,
    },
  });
}

/**
 * เพิ่มค่าตัวนับ (ถ้าไม่มีแถวจะสร้างใหม่)
 * @example
 * await incrementStatDaily(botId, undefined, { total: 1, text: 1 });
 */
export async function incrementStatDaily(
  botId: string,
  dateKey?: string,
  inc: Partial<Record<StatFields, number>> = {}
): Promise<StatDaily> {
  if (!botId) throw new Error("missing botId");
  const key = dateKey ?? todayKey();

  const existing = await prisma.statDaily.findUnique({
    where: { botId_dateKey: { botId, dateKey: key } },
  });

  if (existing) {
    const data: Partial<Record<StatFields, { increment: number }>> = {};

    const fields: StatFields[] = [
      "total",
      "text",
      "follow",
      "unfollow",
      "messageIn",
      "messageOut",
      "casesNew",
      "casesResolved",
    ];

    for (const field of fields) {
      if (typeof inc[field] === "number") {
        data[field] = { increment: inc[field]! } as any;
      }
    }

    if (Object.keys(data).length === 0) return existing;

    return prisma.statDaily.update({
      where: { id: existing.id },
      data,
    });
  }

  // ถ้ายังไม่มี แสดงว่าเป็นแถวใหม่ของวันนั้น
  const tenant = await getBotTenant(botId);

  return prisma.statDaily.create({
    data: {
      bot: { connect: { id: botId } },
      tenant,
      dateKey: key,
      total: inc.total ?? 0,
      text: inc.text ?? 0,
      follow: inc.follow ?? 0,
      unfollow: inc.unfollow ?? 0,
      messageIn: inc.messageIn ?? 0,
      messageOut: inc.messageOut ?? 0,
      casesNew: inc.casesNew ?? 0,
      casesResolved: inc.casesResolved ?? 0,
    },
  });
}

/**
 * อัปเซิร์ตด้วยค่าที่ "ตั้งค่าเป็น" (ไม่ใช่ increment)
 * มีไว้กรณีอยากเซ็ตค่าโดยตรง
 */
export async function upsertStatDaily(
  botId: string,
  dateKey?: string,
  setVals: StatPartial = {}
): Promise<StatDaily> {
  if (!botId) throw new Error("missing botId");
  const key = dateKey ?? todayKey();

  const existing = await prisma.statDaily.findUnique({
    where: { botId_dateKey: { botId, dateKey: key } },
  });

  if (existing) {
    return prisma.statDaily.update({
      where: { id: existing.id },
      data: { ...setVals },
    });
  }

  const tenant = await getBotTenant(botId);

  return prisma.statDaily.create({
    data: {
      bot: { connect: { id: botId } },
      tenant,
      dateKey: key,
      total: setVals.total ?? 0,
      text: setVals.text ?? 0,
      follow: setVals.follow ?? 0,
      unfollow: setVals.unfollow ?? 0,
      messageIn: setVals.messageIn ?? 0,
      messageOut: setVals.messageOut ?? 0,
      casesNew: setVals.casesNew ?? 0,
      casesResolved: setVals.casesResolved ?? 0,
    },
  });
}

/** ดึงสถิติช่วงวัน [from, to] รวมปลายทาง เรียงจากเก่า → ใหม่ */
export async function getStatRange(
  botId: string,
  from: string,
  to: string
): Promise<StatDaily[]> {
  if (!botId) throw new Error("missing botId");
  return prisma.statDaily.findMany({
    where: { botId, dateKey: { gte: from, lte: to } },
    orderBy: { dateKey: "asc" },
  });
}

/**
 * Helper เพิ่มตามชนิดอีเวนต์:
 * - "text": total+1, text+1
 * - "follow": total+1, follow+1
 * - "unfollow": total+1, unfollow+1
 * - อื่นๆ: total+1
 */
export async function addEventStat(
  botId: string,
  kind: "text" | "follow" | "unfollow" | "other" = "other",
  dateKey?: string
): Promise<StatDaily> {
  const inc: Partial<Record<"total" | "text" | "follow" | "unfollow", number>> =
    { total: 1 };

  if (kind === "text") inc.text = 1;
  else if (kind === "follow") inc.follow = 1;
  else if (kind === "unfollow") inc.unfollow = 1;

  return incrementStatDaily(botId, dateKey, inc);
}

/** สร้างแถวของวันนี้ถ้ายังไม่มี แล้วคืนค่า */
export async function ensureTodayStat(botId: string): Promise<StatDaily> {
  const key = todayKey();
  const existing = await findStatDaily(botId, key);
  if (existing) return existing;
  return createStatDaily(botId, key, {
    total: 0,
    text: 0,
    follow: 0,
    unfollow: 0,
  });
}

export async function recordMessageStat(
  botId: string,
  direction: "in" | "out",
  dateKey?: string
): Promise<StatDaily> {
  const inc: Partial<Record<StatFields, number>> = {
    total: 1,
    messageIn: direction === "in" ? 1 : 0,
    messageOut: direction === "out" ? 1 : 0,
  };

  return incrementStatDaily(botId, dateKey, inc);
}

export async function recordCaseStat(
  botId: string,
  kind: "new" | "resolved",
  dateKey?: string
): Promise<StatDaily> {
  const inc: Partial<Record<StatFields, number>> = {
    casesNew: kind === "new" ? 1 : 0,
    casesResolved: kind === "resolved" ? 1 : 0,
  };

  return incrementStatDaily(botId, dateKey, inc);
}

export async function getMetricRange(
  tenant: string,
  from: string,
  to: string
): Promise<StatDaily[]> {
  return prisma.statDaily.findMany({
    where: { tenant, dateKey: { gte: from, lte: to } },
    orderBy: { dateKey: "asc" },
  });
}

