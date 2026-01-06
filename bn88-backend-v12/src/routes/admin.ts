// src/routes/admin.ts
import { Router, type Request, type Response } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { randomInt } from "crypto";
import { prisma } from "../lib/prisma";
import { imageSamplesRouter } from "./admin/imageSamples.js";

const router = Router();
async function getRuleOrThrow(ruleId: string) {
  const rule = await prisma.dailyRule.findUnique({
    where: { id: ruleId },
    select: { id: true, tenant: true, botId: true },
  });
  if (!rule) {
    const err: any = new Error("RULE_NOT_FOUND");
    err.statusCode = 404;
    throw err;
  }
  return rule;
}

function splitCodes(text: string) {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function genDigits(len: number) {
  let out = "";
  for (let i = 0; i < len; i++) out += String(randomInt(0, 10));
  return out;
}

/** GET /api/admin/bots */
router.get("/bots", async (_req: Request, res: Response) => {
  try {
    const items = await prisma.bot.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        tenant: true,
        name: true,
        platform: true,
        active: true,
        verifiedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    res.json({ ok: true, items });
  } catch (err) {
    console.error("GET /api/admin/bots error:", err);
    res.status(500).json({ ok: false, message: "internal_error" });
  }
});
router.use("/admin/image-samples", imageSamplesRouter);

/** POST /api/admin/bots/init */
router.post("/bots/init", async (_req: Request, res: Response) => {
  const tenant = "bn9";
  const name = "admin-bot-001";
  try {
    const existed = await prisma.bot.findFirst({ where: { tenant, name } });
    if (existed) return res.json({ ok: true, bot: existed });

    const bot = await prisma.bot.create({
      data: { tenant, name, active: true },
    });
    res.json({ ok: true, bot });
  } catch (e: any) {
    if ((e as Prisma.PrismaClientKnownRequestError)?.code === "P2002") {
      const bot = await prisma.bot.findFirst({ where: { tenant, name } });
      if (bot) return res.json({ ok: true, bot });
    }
    console.error("POST /api/admin/bots/init error:", e);
    res.status(500).json({ ok: false, message: "create_failed" });
  }
});

/** PATCH /api/admin/bots/:id */
router.patch("/bots/:id", async (req: Request, res: Response) => {
  const id = req.params.id;
  const body = req.body ?? {};
  const data: Prisma.BotUpdateInput = {};
  if (typeof body.name === "string") data.name = body.name.trim().slice(0, 60);
  if (typeof body.active === "boolean") data.active = body.active;

  try {
    const bot = await prisma.bot.update({ where: { id }, data });
    res.json({ ok: true, bot });
  } catch (err) {
    console.error("PATCH /api/admin/bots/:id error:", err);
    res.status(404).json({ ok: false, message: "not_found" });
  }
});

/** DELETE /api/admin/bots/:id */
router.delete("/bots/:id", async (req: Request, res: Response) => {
  try {
    await prisma.bot.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/admin/bots/:id error:", err);
    res.status(404).json({ ok: false, message: "not_found" });
  }
});

/** GET /api/admin/bots/:id/secrets */
router.get("/bots/:id/secrets", async (req: Request, res: Response) => {
  const botId = req.params.id;
  const sec = await prisma.botSecret.findUnique({ where: { botId } });
  res.json({
    ok: true,
    openaiApiKey: sec?.openaiApiKey ? "********" : "",
    lineAccessToken: sec?.channelAccessToken ? "********" : "",
    lineChannelSecret: sec?.channelSecret ? "********" : "",
  });
});

/** POST /api/admin/bots/:id/secrets */
router.post("/bots/:id/secrets", async (req: Request, res: Response) => {
  const botId = req.params.id;
  const { openaiApiKey, lineAccessToken, lineChannelSecret } = (req.body ??
    {}) as {
    openaiApiKey?: string | null;
    lineAccessToken?: string | null;
    lineChannelSecret?: string | null;
  };

  const data: Prisma.BotSecretUpdateInput = {};
  if (openaiApiKey?.trim()) data.openaiApiKey = openaiApiKey.trim();
  if (lineAccessToken?.trim()) data.channelAccessToken = lineAccessToken.trim();
  if (lineChannelSecret?.trim()) data.channelSecret = lineChannelSecret.trim();

  const existing = await prisma.botSecret.findUnique({ where: { botId } });
  if (existing) {
    if (Object.keys(data).length > 0)
      await prisma.botSecret.update({ where: { botId }, data });
  } else {
    await prisma.botSecret.create({
      data: {
        bot: { connect: { id: botId } },
        openaiApiKey: (data as any).openaiApiKey ?? null,
        channelAccessToken: (data as any).channelAccessToken ?? null,
        channelSecret: (data as any).channelSecret ?? null,
      },
    });
  }
  res.json({ ok: true, botId });
});
// =======================
// PHASE 1: CodePool Admin
// =======================

// GET  /api/admin/rules/:ruleId/stock
router.get("/rules/:ruleId/stock", async (req: Request, res: Response) => {
  try {
    const ruleId = String(req.params.ruleId || "");
    const rule = await getRuleOrThrow(ruleId);

    const whereBase = {
      tenant: rule.tenant,
      botId: rule.botId,
      ruleId: rule.id,
    };

    const [total, available] = await Promise.all([
      prisma.codePool.count({ where: whereBase }),
      prisma.codePool.count({
        where: { ...whereBase, status: "AVAILABLE" as any },
      }),
    ]);

    const used = total - available;
    return res.json({ ok: true, ruleId: rule.id, available, used, total });
  } catch (e: any) {
    return res
      .status(e?.statusCode ?? 500)
      .json({ ok: false, error: String(e?.message ?? e) });
  }
});

// POST /api/admin/rules/:ruleId/codepool/generate
const GenBody = z.object({
  count: z.coerce.number().int().min(1).max(2000).default(100),
  prefix: z.string().optional().default("C0D;"),
  digits: z.coerce.number().int().min(4).max(64).default(11),
});

router.post(
  "/rules/:ruleId/codepool/generate",
  async (req: Request, res: Response) => {
    try {
      const ruleId = String(req.params.ruleId || "");
      const rule = await getRuleOrThrow(ruleId);
      const b = GenBody.parse(req.body ?? {});

      const created: string[] = [];
      const seen = new Set<string>();
      const maxAttempts = b.count * 40;
      let attempts = 0;

      while (created.length < b.count && attempts < maxAttempts) {
        attempts++;
        const code = `${b.prefix}${genDigits(b.digits)}`;
        if (seen.has(code)) continue;
        seen.add(code);

        try {
          await prisma.codePool.create({
            data: {
              tenant: rule.tenant,
              botId: rule.botId,
              ruleId: rule.id,
              code,
              status: "AVAILABLE" as any,
            },
          });
          created.push(code);
        } catch (err: any) {
          // unique collision
          if (err?.code === "P2002") continue;
          throw err;
        }
      }

      if (created.length < b.count) {
        return res.status(409).json({
          ok: false,
          error: "COULD_NOT_GENERATE_UNIQUE_CODES",
          created: created.length,
          requested: b.count,
        });
      }

      return res.json({
        ok: true,
        ruleId: rule.id,
        created: created.length,
        codes: created,
      });
    } catch (e: any) {
      return res
        .status(400)
        .json({ ok: false, error: String(e?.message ?? e) });
    }
  }
);

// POST /api/admin/rules/:ruleId/codepool/import
const ImportBody = z.object({
  codesText: z.string().min(1),
});

router.post(
  "/rules/:ruleId/codepool/import",
  async (req: Request, res: Response) => {
    try {
      const ruleId = String(req.params.ruleId || "");
      const rule = await getRuleOrThrow(ruleId);
      const b = ImportBody.parse(req.body ?? {});

      const raw = splitCodes(b.codesText);
      const uniqueInput = Array.from(new Set(raw));

      if (uniqueInput.length === 0) {
        return res.status(400).json({ ok: false, error: "EMPTY_CODES" });
      }

      const whereBase = {
        tenant: rule.tenant,
        botId: rule.botId,
        ruleId: rule.id,
      };

      // กันซ้ำกับ DB ก่อน
      const existing = await prisma.codePool.findMany({
        where: { ...whereBase, code: { in: uniqueInput } },
        select: { code: true },
      });
      const existingSet = new Set(existing.map((x) => x.code));
      const toCreate = uniqueInput.filter((c) => !existingSet.has(c));

      let imported = 0;
      let duplicated = uniqueInput.length - toCreate.length;

      // ห้ามใช้ createMany/skipDuplicates -> ยิง create ทีละตัว
      for (const code of toCreate) {
        try {
          await prisma.codePool.create({
            data: {
              tenant: rule.tenant,
              botId: rule.botId,
              ruleId: rule.id,
              code,
              status: "AVAILABLE" as any,
            },
          });
          imported++;
        } catch (err: any) {
          if (err?.code === "P2002") {
            duplicated++;
            continue;
          }
          throw err;
        }
      }

      return res.json({
        ok: true,
        ruleId: rule.id,
        input: raw.length,
        uniqueInput: uniqueInput.length,
        imported,
        duplicated,
      });
    } catch (e: any) {
      return res
        .status(400)
        .json({ ok: false, error: String(e?.message ?? e) });
    }
  }
);

// (optional) POST /api/admin/rules/:ruleId/codepool/clear  (ลบเฉพาะ AVAILABLE ของ rule นี้)
router.post(
  "/rules/:ruleId/codepool/clear",
  async (req: Request, res: Response) => {
    try {
      const ruleId = String(req.params.ruleId || "");
      const rule = await getRuleOrThrow(ruleId);

      const r = await prisma.codePool.deleteMany({
        where: {
          tenant: rule.tenant,
          botId: rule.botId,
          ruleId: rule.id,
          status: "AVAILABLE" as any,
        },
      });

      return res.json({ ok: true, ruleId: rule.id, cleared: r.count });
    } catch (e: any) {
      return res
        .status(400)
        .json({ ok: false, error: String(e?.message ?? e) });
    }
  }
);

export default router;
