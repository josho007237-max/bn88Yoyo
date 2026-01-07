// src/routes/cases.ts
import { Router, type Request, type Response } from "express";
import { z, ZodError } from "zod";
import { prisma } from "../lib/prisma";
import { emit } from "../live"; // ใช้สตรีม event: case:new
import { createNotificationForCase } from "../services/notifications";

const router = Router();

/* ---------------- helpers ---------------- */
function getStr(q: unknown): string {
  if (typeof q === "string") return q.trim();
  if (Array.isArray(q)) return String(q[0] ?? "").trim();
  return "";
}
function getInt(q: unknown, def = 20, min = 1, max = 100): number {
  const n = Number(getStr(q) || q);
  return Math.min(Math.max(Number.isFinite(n) ? n : def, min), max);
}

/* ========================================================================== */
/* POST /api/cases  -> สร้างเคสใหม่                                           */
/* รองรับ body แบบเก่า/ใหม่:                                                  */
/*   { botId, userId, kind|type, text|message, platform?, meta? }             */
/* แนะนำให้ส่ง header: x-tenant ให้ตรงกับบอท (ถ้ามี multi-tenant)           */
/* ========================================================================== */
router.post("/", async (req: Request, res: Response) => {
  try {
    const tenantHeader = getStr(req.header("x-tenant"));

    // map body ให้รองรับ key เก่า
    const raw = (req.body ?? {}) as Record<string, unknown>;
    const bodyMapped = {
      botId: raw.botId ?? raw.bot_id,
      userId: raw.userId ?? raw.user_id,
      kind: raw.kind ?? raw.type,
      text: raw.text ?? raw.message,
      platform: (raw as any).platform ?? "web", // default ให้เป็น "web" ถ้าไม่ส่งมา
      meta: raw.meta,
    };

    const BodySchema = z.object({
      botId: z.string().min(1, "botId required"),
      userId: z.string().min(1, "userId required"),
      kind: z.string().min(1).transform((v) => v.toLowerCase()),
      text: z.string().min(1),
      platform: z
        .string()
        .min(1)
        .transform((v) => v.toLowerCase()), // เช่น "line" | "web" | "telegram"
      meta: z.any().optional(),
    });

    const data = BodySchema.parse(bodyMapped);

    // หา bot ตาม tenant ถ้ามี header ให้ฟิลเตอร์ด้วย
    const bot = tenantHeader
      ? await prisma.bot.findFirst({
          where: { id: data.botId, tenant: tenantHeader },
        })
      : await prisma.bot.findUnique({ where: { id: data.botId } });

    if (!bot) {
      return res.status(404).json({ ok: false, message: "bot_not_found" });
    }

    // บันทึกเคส (ต้องใส่ tenant + platform ให้ตรง schema ใหม่)
    const item = await prisma.caseItem.create({
      data: {
        botId: bot.id,
        tenant: bot.tenant, // tenant จาก Bot
        platform: data.platform, // "line" | "web" | "telegram" | ...
        userId: data.userId,
        kind: data.kind, // เช่น "deposit" | "withdraw" | "verify" | "other"
        text: data.text,
        meta: (data.meta as any) ?? undefined, // JSON
        // ถ้า schema มี field status เช่น "new" สามารถเพิ่มได้ตรงนี้
        // status: "new",
      },
      select: {
        id: true,
        botId: true,
        userId: true,
        kind: true,
        text: true,
        platform: true,
        createdAt: true,
      },
    });

    await createNotificationForCase({
      id: item.id,
      tenant: bot.tenant,
      botId: bot.id,
      kind: data.kind,
      userId: data.userId,
      text: data.text,
      meta: data.meta,
    });

    // ส่งอีเวนต์แบบเรียลไทม์ขึ้นแดชบอร์ด
    emit("case:new", bot.tenant, { ...item });

    return res.status(201).json({ ok: true, item });
  } catch (e: any) {
    if (e instanceof ZodError) {
      return res.status(400).json({
        ok: false,
        message: "invalid_input",
        issues: e.issues,
      });
    }
    console.error("[POST /api/cases]", e);
    return res.status(500).json({ ok: false, message: "internal_error" });
  }
});

/* -----------------------------------------------------------
 * GET /api/cases/recent?botId=...&limit=20
 * - เคสล่าสุดของบอทเดียว (ตาม botId)
 * --------------------------------------------------------- */
router.get("/recent", async (req: Request, res: Response) => {
  try {
    const botId = getStr(req.query.botId);
    if (!botId) {
      return res.status(400).json({ ok: false, message: "missing_botId" });
    }

    const limit = getInt(req.query.limit, 20, 1, 100);

    const items = await prisma.caseItem.findMany({
      where: { botId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        botId: true,
        userId: true,
        text: true,
        kind: true,
        platform: true,
        createdAt: true,
      },
    });

    return res.json({ ok: true, items });
  } catch (e) {
    console.error("[GET /api/cases/recent]", e);
    return res.status(500).json({ ok: false, message: "internal_error" });
  }
});

/* -----------------------------------------------------------
 * GET /api/cases/:tenant/recent?limit=20
 * - รวมเคสล่าสุดของทุกบอทใน tenant
 * --------------------------------------------------------- */
router.get("/:tenant/recent", async (req: Request, res: Response) => {
  try {
    const tenant = getStr(req.params.tenant);
    if (!tenant) {
      return res.status(400).json({ ok: false, message: "missing_tenant" });
    }

    const limit = getInt(req.query.limit, 20, 1, 100);

    const bots = await prisma.bot.findMany({
      where: { tenant },
      select: { id: true },
    });

    const botIds = bots.map((b) => b.id);
    if (botIds.length === 0) {
      return res.json({ ok: true, items: [] });
    }

    const items = await prisma.caseItem.findMany({
      where: { botId: { in: botIds } },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        botId: true,
        userId: true,
        text: true,
        kind: true,
        platform: true,
        createdAt: true,
      },
    });

    return res.json({ ok: true, items });
  } catch (e) {
    console.error("[GET /api/cases/:tenant/recent]", e);
    return res.status(500).json({ ok: false, message: "internal_error" });
  }
});

export default router;
