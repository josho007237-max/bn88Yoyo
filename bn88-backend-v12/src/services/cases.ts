// src/services/cases.ts
import { prisma } from "../lib/prisma";
import { recordCaseStat } from "./stats";
import { createNotificationForCase } from "./notifications";

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

export function pendingTTL(pendingAt: unknown, ttlMs = 12 * 60 * 60 * 1000) {
  const ts =
    typeof pendingAt === "number"
      ? pendingAt
      : pendingAt instanceof Date
        ? pendingAt.getTime()
        : typeof pendingAt === "string"
          ? Date.parse(pendingAt)
          : null;

  if (!ts) return true;

  return Date.now() - ts > ttlMs;
}

export async function dedupeCase(
  sessionId: string | null,
  userId: string,
  kind: string,
  withinMs = 15 * 60 * 1000
) {
  const windowStart = new Date(Date.now() - withinMs);

  const where: any = {
    userId,
    kind,
    createdAt: { gte: windowStart },
  };

  if (sessionId) where.sessionId = sessionId;

  return prisma.caseItem.findFirst({
    where,
    orderBy: { createdAt: "desc" },
  });
}

type CaseNote = {
  text: string;
  via: string;
  addedAt: string;
  attachmentUrl?: string | null;
  meta?: unknown;
};

function appendCaseNoteMeta(existingMeta: unknown, note: CaseNote) {
  const base = (existingMeta as any) ?? {};
  const notes = Array.isArray(base.notes) ? base.notes : [];

  return {
    ...base,
    notes: [...notes, note],
  } as any;
}

export type CreateCaseWithDedupeOptions = CreateCaseOptions & {
  sessionId?: string | null;
  dedupeWindowMs?: number;
  noteVia?: string;
  attachmentUrl?: string | null;
  noteMeta?: unknown;
  imageIntakeId?: string | null;
};

export async function createCaseWithDedupe(options: CreateCaseWithDedupeOptions) {
  const {
    tenant,
    botId,
    platform,
    userId,
    kind,
    text,
    meta,
    sessionId = null,
    dedupeWindowMs,
    noteVia = "followup",
    attachmentUrl = null,
    noteMeta = null,
    imageIntakeId = null,
  } = options;

  const existing = await dedupeCase(sessionId, userId, kind, dedupeWindowMs);
  const nowIso = new Date().toISOString();

  if (existing) {
    const nextMeta = appendCaseNoteMeta(existing.meta, {
      text,
      via: noteVia,
      addedAt: nowIso,
      attachmentUrl,
      meta: noteMeta,
    });

    const updated = await prisma.caseItem.update({
      where: { id: existing.id },
      data: {
        text,
        meta: nextMeta as any,
        imageIntakeId: imageIntakeId ?? existing.imageIntakeId,
      },
    });

    return { caseItem: updated, created: false } as const;
  }

  const nextMeta = appendCaseNoteMeta(meta ?? null, {
    text,
    via: noteVia,
    addedAt: nowIso,
    attachmentUrl,
    meta: noteMeta,
  });

  const created = await prisma.caseItem.create({
    data: {
      tenant,
      botId,
      platform,
      sessionId,
      userId,
      kind,
      text,
      meta: nextMeta as any,
      imageIntakeId,
    },
  });

  await recordCaseStat(botId, "new");
  await createNotificationForCase(created);

  return { caseItem: created, created: true } as const;
}
