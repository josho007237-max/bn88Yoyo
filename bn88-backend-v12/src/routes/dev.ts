// src/routes/dev.ts
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { approveActivityCase } from "../services/activity/approveActivityCase";

// export ทั้ง named + default เหมือนเดิม
export const dev = Router();

// (ออปชัน) ถ้ามีตัว publish ใน live.ts จะใช้ยิง SSE ให้ FE รีเฟรช
let publish: ((tenant: string, event: string, data?: any) => void) | null =
  null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const live = require("../live");
  publish = live.publish || live.emit || null;
} catch {
  /* ไม่มี live publisher ก็ข้ามได้ */
}

/* ============================================================================
 * POST /api/dev/activity/approve
 * body: { caseId }
 * - ใช้ทดสอบ: แอดมินอนุมัติเคสกิจกรรม -> แจกโค้ด -> push ไป LINE
 * ========================================================================== */
const ApproveBody = z.object({
  caseId: z.string().min(1, "caseId required"),
});

dev.post("/dev/activity/approve", async (req: Request, res: Response) => {
  try {
    const { caseId } = ApproveBody.parse(req.body);

    // ดึง tenant/botId ไว้ยิง SSE หลังอนุมัติ
    const c = await prisma.caseItem.findUnique({
      where: { id: caseId },
      select: { id: true, tenant: true, botId: true },
    });
    if (!c) return res.status(404).json({ ok: false, error: "CASE_NOT_FOUND" });

    const r = await approveActivityCase({ caseId });

    // ยิง SSE ให้หน้า FE รีเฟรช ถ้ามี publisher
    try {
      publish?.(c.tenant, "case:update", { id: c.id, botId: c.botId });
      publish?.(c.tenant, "stats:update", { botId: c.botId });
    } catch {
      /* ignore */
    }

    return res.json({ ok: true, ...r });
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    return res.status(400).json({ ok: false, error: msg });
  }
});

/* ============================================================================
 * GET /api/dev/line-ping/:botId
 * - ใช้ตรวจ LINE Channel Access Token ทำงานไหม
 * ========================================================================== */
dev.get("/dev/line-ping/:botId", async (req: Request, res: Response) => {
  const botId = String(req.params.botId || "");
  if (!botId)
    return res.status(400).json({ ok: false, message: "missing_botId" });

  const secrets = await prisma.botSecret.findUnique({ where: { botId } });

  // รองรับได้หลายชื่อฟิลด์
  const accessToken =
    (secrets as any)?.lineAccessToken ??
    (secrets as any)?.channelAccessToken ??
    (secrets as any)?.line_token ??
    "";

  if (!accessToken) {
    return res.status(400).json({ ok: false, message: "missing_access_token" });
  }

  try {
    const r = await fetch("https://api.line.me/v2/bot/info", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    let info: any = {};
    try {
      info = await r.json();
    } catch {
      /* ignore */
    }

    return res.status(200).json({ ok: r.ok, status: r.status, info });
  } catch (e: any) {
    return res.status(500).json({
      ok: false,
      message: "line_ping_failed",
      error: String(e?.message ?? e),
    });
  }
});

/* ============================================================================
 * GET /api/dev/telegram-ping/:botId
 * - ใช้ตรวจ Telegram Bot Token ทำงานไหม (เรียก getMe)
 * ========================================================================== */
dev.get("/dev/telegram-ping/:botId", async (req: Request, res: Response) => {
  const botId = String(req.params.botId || "");
  if (!botId)
    return res.status(400).json({ ok: false, message: "missing_botId" });

  const secrets = await prisma.botSecret.findUnique({ where: { botId } });

  const botToken =
    (secrets as any)?.telegramBotToken ??
    (secrets as any)?.botToken ??
    (secrets as any)?.channelAccessToken ??
    "";

  if (!botToken)
    return res.status(400).json({ ok: false, message: "missing_bot_token" });

  try {
    const url = `https://api.telegram.org/bot${botToken}/getMe`;
    const resp = await fetch(url);
    const raw = await resp.text().catch(() => "");
    let data: any = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      /* ignore */
    }

    if (!resp.ok || !data?.ok) {
      return res.status(400).json({
        ok: false,
        message: "telegram_ping_failed",
        status: resp.status,
        info: data ?? raw,
      });
    }

    return res.status(200).json({
      ok: true,
      message: "telegram_ping_ok",
      status: resp.status,
      info: data.result ?? data,
    });
  } catch (e: any) {
    return res.status(500).json({
      ok: false,
      message: "telegram_ping_failed",
      error: String(e?.message ?? e),
    });
  }
});

/* ============================================================================
 * POST /api/dev/case
 * - ยิงเคสจำลองให้ตาราง/สถิติใน Dashboard ขยับแบบทันที
 * body: { botId, userId?, kind?, text? }
 * ========================================================================== */
const DevCaseBody = z.object({
  botId: z.string().min(1, "botId required"),
  userId: z.string().optional(),
  kind: z
    .enum(["deposit", "withdraw", "kyc", "register", "other"])
    .default("other"),
  text: z.string().optional(),
});

dev.post("/dev/case", async (req: Request, res: Response) => {
  try {
    const b = DevCaseBody.parse(req.body);

    const bot = await prisma.bot.findUnique({
      where: { id: b.botId },
      select: { id: true, tenant: true },
    });
    if (!bot)
      return res.status(404).json({ ok: false, message: "bot_not_found" });

    const tenant = bot.tenant;
    const platform = "dev";
    const userId = b.userId ?? "dev-user";

    const item = await prisma.caseItem.create({
      data: {
        tenant,
        botId: bot.id,
        platform,
        userId,
        kind: b.kind,
        text: b.text ?? "",
        meta: {},
      },
      select: {
        id: true,
        botId: true,
        userId: true,
        kind: true,
        text: true,
        createdAt: true,
      },
    });

    const dateKey = new Date().toISOString().slice(0, 10);
    await prisma.statDaily.upsert({
      where: { botId_dateKey: { botId: bot.id, dateKey } },
      update: { total: { increment: 1 }, text: { increment: 1 } },
      create: {
        botId: bot.id,
        tenant,
        dateKey,
        total: 1,
        text: 1,
        follow: 0,
        unfollow: 0,
      },
    });

    try {
      publish?.(tenant, "case:new", { botId: bot.id, id: item.id });
      publish?.(tenant, "stats:update", { botId: bot.id, dateKey });
    } catch {
      /* ignore */
    }

    return res.json({ ok: true, item });
  } catch (e: any) {
    return res
      .status(400)
      .json({ ok: false, message: String(e?.message || "bad_request") });
  }
});

/* ============================================================================
 * POST /api/dev/ai-test
 * ========================================================================== */
dev.post("/dev/ai-test", async (req: Request, res: Response) => {
  const q = String(req.body?.q ?? "");
  const botId = String(req.body?.botId ?? "dev-bot");
  if (!q) return res.status(400).json({ ok: false, message: "missing_q" });

  const cfg = await prisma.botConfig.findUnique({ where: { botId } });

  return res.status(200).json({
    ok: true,
    echo: q,
    using: {
      model: cfg?.model ?? "gpt-4o-mini",
      temperature: cfg?.temperature ?? 0.3,
      topP: cfg?.topP ?? 1,
      maxTokens: cfg?.maxTokens ?? 800,
    },
  });
});

export default dev;

