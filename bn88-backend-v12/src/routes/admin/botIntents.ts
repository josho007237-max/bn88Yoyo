// src/routes/admin/botIntents.ts
import { Router, type Request, type Response } from "express";
import { prisma } from "../../lib/prisma";
import { authGuard } from "../../mw/auth";

const r = Router();
r.use(authGuard);

function getTenant(req: Request): string {
  const h = (req.header("x-tenant") || "").trim();
  return h || "bn9";
}

/**
 * Helper: แปลง keywords จาก body ให้เป็น string[]
 */
function normalizeKeywords(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((s) => String(s).trim()).filter(Boolean);
  }
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * GET /api/admin/bots/:botId/intents
 */
r.get("/:botId/intents", async (req: Request, res: Response) => {
  try {
    const tenant = getTenant(req);
    const botId = req.params.botId;

    const bot = await prisma.bot.findFirst({
      where: { id: botId, tenant },
      select: { id: true },
    });
    if (!bot) {
      return res.status(404).json({ ok: false, message: "bot_not_found" });
    }

    const intents = await prisma.botIntent.findMany({
      where: { tenant, botId },
      orderBy: { createdAt: "asc" },
    });

    return res.json({ ok: true, items: intents });
  } catch (e) {
    console.error("[GET /admin/bots/:botId/intents]", e);
    return res.status(500).json({ ok: false, message: "internal_error" });
  }
});

/**
 * POST /api/admin/bots/:botId/intents
 * body: { code, title, keywords?, fallback? }
 */
r.post("/:botId/intents", async (req: Request, res: Response) => {
  try {
    const tenant = getTenant(req);
    const botId = req.params.botId;
    const { code, title, keywords, fallback } = (req.body ?? {}) as any;

    if (!code || !title) {
      return res
        .status(400)
        .json({ ok: false, message: "code/title required" });
    }

    const bot = await prisma.bot.findFirst({
      where: { id: botId, tenant },
      select: { id: true },
    });
    if (!bot) {
      return res.status(404).json({ ok: false, message: "bot_not_found" });
    }

    const kw = normalizeKeywords(keywords);

    const item = await prisma.botIntent.create({
      data: {
        tenant,
        botId,
        code: String(code),
        title: String(title),
        keywords: kw,
        fallback: fallback ? String(fallback) : null,
      },
    });

    return res.json({ ok: true, item });
  } catch (e) {
    console.error("[POST /admin/bots/:botId/intents]", e);
    return res.status(500).json({ ok: false, message: "internal_error" });
  }
});

/**
 * PUT /api/admin/bots/:botId/intents/:id
 * body: { code?, title?, keywords?, fallback? }
 */
r.put("/:botId/intents/:id", async (req: Request, res: Response) => {
  try {
    const tenant = getTenant(req);
    const botId = req.params.botId;
    const id = req.params.id;
    const { code, title, keywords, fallback } = (req.body ?? {}) as any;

    const bot = await prisma.bot.findFirst({
      where: { id: botId, tenant },
      select: { id: true },
    });
    if (!bot) {
      return res.status(404).json({ ok: false, message: "bot_not_found" });
    }

    const existing = await prisma.botIntent.findFirst({
      where: { id, botId, tenant },
    });
    if (!existing) {
      return res.status(404).json({ ok: false, message: "intent_not_found" });
    }

    const kw = normalizeKeywords(keywords ?? existing.keywords);

    const item = await prisma.botIntent.update({
      where: { id },
      data: {
        code: code ? String(code) : existing.code,
        title: title ? String(title) : existing.title,
        keywords: kw,
        fallback:
          typeof fallback === "string"
            ? fallback
            : fallback === null
            ? null
            : existing.fallback,
      },
    });

    return res.json({ ok: true, item });
  } catch (e) {
    console.error("[PUT /admin/bots/:botId/intents/:id]", e);
    return res.status(500).json({ ok: false, message: "internal_error" });
  }
});

/**
 * DELETE /api/admin/bots/:botId/intents/:id
 */
r.delete("/:botId/intents/:id", async (req: Request, res: Response) => {
  try {
    const tenant = getTenant(req);
    const botId = req.params.botId;
    const id = req.params.id;

    const bot = await prisma.bot.findFirst({
      where: { id: botId, tenant },
      select: { id: true },
    });
    if (!bot) {
      return res.status(404).json({ ok: false, message: "bot_not_found" });
    }

    const existing = await prisma.botIntent.findFirst({
      where: { id, botId, tenant },
      select: { id: true },
    });
    if (!existing) {
      return res.status(404).json({ ok: false, message: "intent_not_found" });
    }

    await prisma.botIntent.delete({ where: { id } });

    return res.json({ ok: true });
  } catch (e) {
    console.error("[DELETE /admin/bots/:botId/intents/:id]", e);
    return res.status(500).json({ ok: false, message: "internal_error" });
  }
});

export default r;
