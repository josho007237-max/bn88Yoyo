import { Router, type Request, type Response } from "express";
import { prisma } from "../../lib/prisma";
import { todayKey } from "../../services/stats";

const router = Router();

function getTenant(req: Request): string {
  return (
    (req.headers["x-tenant"] as string) ||
    process.env.TENANT_DEFAULT ||
    "bn9"
  );
}

function toDateKey(value: unknown): string | null {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function defaultRange(): { from: string; to: string } {
  const today = todayKey();
  const d = new Date();
  d.setDate(d.getDate() - 6);
  const from = d.toISOString().slice(0, 10);
  return { from, to: today };
}

function normalizeRange(req: Request): { from: string; to: string } | null {
  const fallback = defaultRange();
  const from = toDateKey(req.query.from) ?? fallback.from;
  const to = toDateKey(req.query.to) ?? fallback.to;
  if (from > to) return null;
  return { from, to };
}

function getBotId(req: Request): string | null {
  const raw = req.query.botId;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return null;
}

router.get("/chat", async (req: Request, res: Response) => {
  const range = normalizeRange(req);
  if (!range) return res.status(400).json({ ok: false, message: "invalid_range" });

  const tenant = getTenant(req);
  const botId = getBotId(req);

  try {
    const rows = await prisma.statDaily.findMany({
      where: {
        tenant,
        ...(botId ? { botId } : {}),
        dateKey: { gte: range.from, lte: range.to },
      },
      orderBy: { dateKey: "asc" },
      select: {
        botId: true,
        dateKey: true,
        messageIn: true,
        messageOut: true,
      },
    });

    const summary = rows.reduce(
      (a, x) => ({
        messageIn: a.messageIn + (x.messageIn ?? 0),
        messageOut: a.messageOut + (x.messageOut ?? 0),
      }),
      { messageIn: 0, messageOut: 0 }
    );

    const items = rows.map((r) => ({
      dateKey: r.dateKey,
      messageIn: r.messageIn ?? 0,
      messageOut: r.messageOut ?? 0,
      botId: r.botId,
    }));

    return res.json({ ok: true, range, items, summary });
  } catch (err) {
    console.error("[GET /api/admin/metrics/chat]", err);
    return res.status(500).json({ ok: false, message: "internal_error_metrics_chat" });
  }
});

router.get("/cases", async (req: Request, res: Response) => {
  const range = normalizeRange(req);
  if (!range) return res.status(400).json({ ok: false, message: "invalid_range" });
  const tenant = getTenant(req);
  const botId = getBotId(req);

  try {
    const rows = await prisma.statDaily.findMany({
      where: {
        tenant,
        ...(botId ? { botId } : {}),
        dateKey: { gte: range.from, lte: range.to },
      },
      orderBy: { dateKey: "asc" },
      select: {
        botId: true,
        dateKey: true,
        casesNew: true,
        casesResolved: true,
      },
    });

    const summary = rows.reduce(
      (a, x) => ({
        casesNew: a.casesNew + (x.casesNew ?? 0),
        casesResolved: a.casesResolved + (x.casesResolved ?? 0),
      }),
      { casesNew: 0, casesResolved: 0 }
    );

    const items = rows.map((r) => ({
      dateKey: r.dateKey,
      casesNew: r.casesNew ?? 0,
      casesResolved: r.casesResolved ?? 0,
      botId: r.botId,
    }));

    return res.json({ ok: true, range, items, summary });
  } catch (err) {
    console.error("[GET /api/admin/metrics/cases]", err);
    return res.status(500).json({ ok: false, message: "internal_error_metrics_cases" });
  }
});

export default router;
