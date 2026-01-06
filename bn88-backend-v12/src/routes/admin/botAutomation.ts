import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { createRequestLogger } from "../../utils/logger";
import { scheduleEngagementMessage } from "../../services/engagementScheduler";

const router = Router();

/** ทำให้ meta/keywords กลายเป็น JSON-safe สำหรับ Prisma */
import type { JsonValue } from "../../lib/jsonValue.js";
import { toJsonValue as normalizeJson } from "../../lib/jsonValue.js";

function toJsonValue(value: unknown): JsonValue {
  return normalizeJson(value);
}

/** query botId */
const botIdQuery = z.object({
  botId: z.string().min(1),
});

/** FAQ schemas */
const faqCreateSchema = z.object({
  botId: z.string().min(1),
  question: z.string().min(1),
  answer: z.string().min(1),
  keywords: z.array(z.string()).optional(), // ถ้ามี
});

const faqUpdateSchema = z.object({
  question: z.string().min(1).optional(),
  answer: z.string().min(1).optional(),
  keywords: z.array(z.string()).optional(), // ถ้ามี
});

/** Engagement schemas */
const engagementCreateSchema = z.object({
  botId: z.string().min(1),
  platform: z.string().min(1).optional().default("line"),
  channelId: z.string().min(1),
  text: z.string().min(1),
  interval: z.coerce.number().int().positive(),
  enabled: z.boolean().optional(),
  type: z.string().optional(),
  meta: z.any().optional(),
});

const engagementUpdateSchema = engagementCreateSchema.partial().extend({
  botId: z.string().min(1).optional(),
});

/* ----------------------------- FAQ service ----------------------------- */

export async function listFaq(botId: string) {
  // ถ้า model ของพี่ไม่มี field botId ตรง ๆ ให้ใช้ relation filter แบบนี้
  return prisma.fAQ.findMany({
    where: { bot: { id: botId } },
    orderBy: { createdAt: "asc" },
  });
}

export async function createFaq(input: z.infer<typeof faqCreateSchema>) {
  const data = {
    bot: { connect: { id: input.botId } },
    question: input.question,
    answer: input.answer,
  };

  return prisma.fAQ.create({ data });
}

export async function updateFaq(
  id: string,
  input: z.infer<typeof faqUpdateSchema>
) {
  // update ไม่ต้องส่ง botId
  const data = {
    ...(input.question !== undefined ? { question: input.question } : {}),
    ...(input.answer !== undefined ? { answer: input.answer } : {}),
  };

  return prisma.fAQ.update({ where: { id }, data });
}

export async function deleteFaq(id: string) {
  return prisma.fAQ.delete({ where: { id } });
}

/* ----------------------------- FAQ routes ------------------------------ */

router.get("/faq", async (req, res) => {
  const parsed = botIdQuery.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, message: "botId_required" });
  }

  const items = await listFaq(parsed.data.botId);
  return res.json({ ok: true, items });
});

router.post("/faq", async (req, res) => {
  const parsed = faqCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      message: "invalid_body",
      issues: parsed.error.issues,
    });
  }

  const faq = await createFaq(parsed.data);
  return res.status(201).json({ ok: true, item: faq });
});

router.put("/faq/:id", async (req, res) => {
  const id = req.params.id;

  const parsed = faqUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      message: "invalid_body",
      issues: parsed.error.issues,
    });
  }

  const existing = await prisma.fAQ.findUnique({ where: { id } });
  if (!existing)
    return res.status(404).json({ ok: false, message: "faq_not_found" });

  const faq = await updateFaq(id, parsed.data);
  return res.json({ ok: true, item: faq });
});

router.delete("/faq/:id", async (req, res) => {
  const id = req.params.id;

  const existing = await prisma.fAQ.findUnique({ where: { id } });
  if (!existing)
    return res.status(404).json({ ok: false, message: "faq_not_found" });

  await deleteFaq(id);
  return res.json({ ok: true });
});

/* -------------------------- Engagement service ------------------------- */

export async function listEngagement(botId: string) {
  return prisma.engagementMessage.findMany({
    where: { bot: { id: botId } },
    orderBy: { createdAt: "asc" },
  });
}

export async function createEngagement(
  input: z.infer<typeof engagementCreateSchema>
) {
  const data = {
    bot: { connect: { id: input.botId } },
    platform: input.platform ?? "line",
    channelId: input.channelId,
    text: input.text,
    interval: input.interval,
    enabled: input.enabled ?? true,
    ...(input.type !== undefined ? { type: input.type } : {}),
    ...(input.meta !== undefined ? { meta: toJsonValue(input.meta) } : {}),
  };

  const created = await prisma.engagementMessage.create({ data });

  await scheduleEngagementMessage(created).catch((err) => {
    createRequestLogger().warn("[engagement] schedule error", err);
  });

  return created;
}

export async function updateEngagement(
  id: string,
  input: z.infer<typeof engagementUpdateSchema>
) {
  const data = {
    ...(input.botId ? { bot: { connect: { id: input.botId } } } : {}),
    ...(input.platform !== undefined ? { platform: input.platform } : {}),
    ...(input.channelId !== undefined ? { channelId: input.channelId } : {}),
    ...(input.text !== undefined ? { text: input.text } : {}),
    ...(input.interval !== undefined ? { interval: input.interval } : {}),
    ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
    ...(input.type !== undefined ? { type: input.type } : {}),
    ...(input.meta !== undefined ? { meta: toJsonValue(input.meta) } : {}),
  };

  const updated = await prisma.engagementMessage.update({
    where: { id },
    data,
  });

  await scheduleEngagementMessage(updated).catch((err) => {
    createRequestLogger().warn("[engagement] reschedule error", err);
  });

  return updated;
}

export async function deleteEngagement(id: string) {
  return prisma.engagementMessage.delete({ where: { id } });
}

/* -------------------------- Engagement routes -------------------------- */

router.get("/engagement", async (req, res) => {
  const parsed = botIdQuery.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, message: "botId_required" });
  }

  const items = await listEngagement(parsed.data.botId);
  return res.json({ ok: true, items });
});

router.post("/engagement", async (req, res) => {
  const parsed = engagementCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      message: "invalid_body",
      issues: parsed.error.issues,
    });
  }

  const created = await createEngagement({
    ...parsed.data,
    enabled: parsed.data.enabled ?? true,
  });
  return res.status(201).json({ ok: true, item: created });
});

router.put("/engagement/:id", async (req, res) => {
  const id = req.params.id;

  const parsed = engagementUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      message: "invalid_body",
      issues: parsed.error.issues,
    });
  }

  const existing = await prisma.engagementMessage.findUnique({ where: { id } });
  if (!existing)
    return res.status(404).json({ ok: false, message: "engagement_not_found" });

  const updated = await updateEngagement(id, parsed.data);
  return res.json({ ok: true, item: updated });
});

router.delete("/engagement/:id", async (req, res) => {
  const id = req.params.id;

  const existing = await prisma.engagementMessage.findUnique({ where: { id } });
  if (!existing)
    return res.status(404).json({ ok: false, message: "engagement_not_found" });

  await deleteEngagement(id);
  return res.json({ ok: true });
});

export default router;
