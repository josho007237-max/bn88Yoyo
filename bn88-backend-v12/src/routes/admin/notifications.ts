import { Router, type Request, type Response } from "express";
import { prisma } from "../../lib/prisma";

const router = Router();

function getTenant(req: Request): string {
  return (
    (req.headers["x-tenant"] as string) ||
    process.env.TENANT_DEFAULT ||
    "bn9"
  );
}

function getLimit(req: Request, fallback = 50, max = 200): number {
  const raw = typeof req.query.limit === "string" ? req.query.limit : "";
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), max);
}

function getStatus(req: Request): "all" | "unread" | "read" {
  const raw = typeof req.query.status === "string" ? req.query.status : "";
  const normalized = raw.trim().toLowerCase();
  if (normalized === "unread") return "unread";
  if (normalized === "read") return "read";
  return "all";
}

router.get("/", async (req: Request, res: Response) => {
  const tenant = getTenant(req);
  const status = getStatus(req);
  const limit = getLimit(req);

  try {
    const where: any = { tenant };
    if (status === "unread") where.isRead = false;
    if (status === "read") where.isRead = true;

    const items = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        tenant: true,
        botId: true,
        caseId: true,
        kind: true,
        title: true,
        body: true,
        isRead: true,
        readAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.json({ ok: true, items });
  } catch (err) {
    console.error("[GET /api/admin/notifications]", err);
    return res
      .status(500)
      .json({ ok: false, message: "internal_error_notifications" });
  }
});

router.patch("/:id", async (req: Request, res: Response) => {
  const tenant = getTenant(req);
  const id = req.params.id;
  const isRead = Boolean((req.body as any)?.isRead ?? true);
  const auth = (req as any).auth as { sub?: string } | undefined;

  try {
    const existing = await prisma.notification.findFirst({
      where: { id, tenant },
    });

    if (!existing) {
      return res.status(404).json({ ok: false, message: "not_found" });
    }

    const next = await prisma.notification.update({
      where: { id: existing.id },
      data: {
        isRead,
        readAt: isRead ? new Date() : null,
        readById: isRead ? auth?.sub ?? null : null,
      },
      select: {
        id: true,
        tenant: true,
        botId: true,
        caseId: true,
        kind: true,
        title: true,
        body: true,
        isRead: true,
        readAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.json({ ok: true, item: next });
  } catch (err) {
    console.error("[PATCH /api/admin/notifications/:id]", err);
    return res
      .status(500)
      .json({ ok: false, message: "internal_error_notifications" });
  }
});

export default router;
