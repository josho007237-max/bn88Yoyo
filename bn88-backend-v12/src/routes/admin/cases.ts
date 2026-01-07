// src/routes/admin/cases.ts
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { safeBroadcast } from "../../services/actions/utils";
import { recordCaseStat } from "../../services/stats";

const router = Router();

const ALLOWED_STATUSES = ["PENDING", "REVIEW", "RESOLVED"] as const;
type AdminCaseStatus = (typeof ALLOWED_STATUSES)[number];

const caseInclude = {
  session: {
    select: { id: true, displayName: true, userId: true, platform: true },
  },
  bot: { select: { id: true, name: true } },
  imageIntake: { select: { id: true, imageUrl: true, classification: true } },
  assignee: { select: { id: true, email: true } },
};

type CaseWithRelations = NonNullable<Awaited<ReturnType<typeof prisma.caseItem.findFirst>>>;

function getTenant(req: Request): string {
  return (
    (req.headers["x-tenant"] as string) ||
    process.env.TENANT_DEFAULT ||
    "bn9"
  );
}

function getString(q: unknown): string {
  if (typeof q === "string") return q.trim();
  if (Array.isArray(q)) return getString(q[0]);
  return "";
}

function parseStatus(value: unknown): AdminCaseStatus[] {
  const raw = getString(value);
  if (!raw) return [];
  const tokens = raw
    .split(/[,\s]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  const allowed = new Set(ALLOWED_STATUSES.map((s) => String(s).toUpperCase()));
  return tokens
    .map((t) => ALLOWED_STATUSES.find((s) => String(s).toUpperCase() === t))
    .filter((s): s is AdminCaseStatus => Boolean(s) && allowed.has(String(s)));
}

function normalizeAttachments(item: CaseWithRelations) {
  const meta = (item.meta ?? {}) as any;
  const urls: string[] = [];

  const attachments: {
    url: string;
    source: string;
    type: "image" | "file";
    lineContentId: string | null;
  }[] = [];

  const guessType = (url: string): "image" | "file" => {
    const lower = url.toLowerCase();
    if (/[.](pdf|doc|docx|xls|xlsx|csv)$/i.test(lower)) return "file";
    return "image";
  };

  const pushUrl = (url?: string | null, source = "meta") => {
    const u = (url ?? "").trim();
    if (!u) return;
    if (urls.includes(u)) return;
    urls.push(u);
    attachments.push({
      url: u,
      source,
      type: guessType(u),
      lineContentId: u.includes("/line-content/") ? u.split("/line-content/").pop() ?? null : null,
    });
  };

  pushUrl(meta?.attachmentUrl, "meta");
  pushUrl(meta?.imageUrl, "meta");

  if (Array.isArray(meta?.attachments)) {
    meta.attachments.forEach((a: any) => {
      if (typeof a === "string") return pushUrl(a, "meta");
      pushUrl(a?.url, "meta");
    });
  }

  if (Array.isArray(meta?.images)) {
    meta.images.forEach((img: any) => pushUrl(img?.url ?? img, "meta"));
  }

  pushUrl(item.imageIntake?.imageUrl ?? undefined, "imageIntake");

  return attachments;
}

function serializeCase(item: CaseWithRelations) {
  return {
    ...item,
    attachments: normalizeAttachments(item),
  };
}

router.get("/", async (req: Request, res: Response) => {
  try {
    const tenant = getTenant(req);
    const page = Math.max(parseInt(getString(req.query.page)) || 1, 1);
    const pageSize = Math.min(
      Math.max(parseInt(getString(req.query.pageSize)) || 20, 1),
      50,
    );
    const statusList = parseStatus(req.query.status);
    const kind = getString(req.query.kind);
    const q = getString(req.query.q);

    const where: Record<string, any> = { tenant };
    if (statusList.length > 0) {
      where.status = { in: statusList } as any;
    }
    if (kind) {
      where.kind = { contains: kind, mode: "insensitive" } as any;
    }
    if (q) {
      where.OR = [
        { text: { contains: q, mode: "insensitive" } },
        { userId: { contains: q, mode: "insensitive" } },
        { reviewNotes: { contains: q, mode: "insensitive" } },
      ];
    }

    const [total, items] = await prisma.$transaction([
      prisma.caseItem.count({ where }),
      prisma.caseItem.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: caseInclude,
      }),
    ]);

    return res.json({
      ok: true,
      total,
      page,
      pageSize,
      items: items.map(serializeCase),
    });
  } catch (err) {
    console.error("[GET /api/admin/cases]", err);
    return res.status(500).json({ ok: false, message: "internal_error_list_cases" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const tenant = getTenant(req);
    const id = getString(req.params.id);

    const item = await prisma.caseItem.findFirst({
      where: { id, tenant },
      include: caseInclude,
    });

    if (!item) {
      return res.status(404).json({ ok: false, message: "case_not_found" });
    }

    return res.json({ ok: true, item: serializeCase(item) });
  } catch (err) {
    console.error("[GET /api/admin/cases/:id]", err);
    return res.status(500).json({ ok: false, message: "internal_error_case_detail" });
  }
});

const patchSchema = z.object({
  status: z.enum(["PENDING", "REVIEW", "RESOLVED"] as const).optional(),
  reviewNotes: z.string().trim().max(2000).optional(),
  resolvedAt: z.coerce.date().optional().nullable(),
  assigneeId: z.string().trim().min(1).optional().nullable(),
});

router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const tenant = getTenant(req);
    const id = getString(req.params.id);
    const parsed = patchSchema.parse(req.body ?? {});

    const existing = await prisma.caseItem.findFirst({
      where: { id, tenant },
      include: caseInclude,
    });
    if (!existing) {
      return res.status(404).json({ ok: false, message: "case_not_found" });
    }

    const data: Record<string, any> = {};
    const becameResolved =
      parsed.status === "RESOLVED" && existing.status !== "RESOLVED";

    if (parsed.reviewNotes !== undefined) {
      data.reviewNotes = parsed.reviewNotes || null;
    }

    if (parsed.status) {
      data.status = parsed.status;
      if (parsed.status === "RESOLVED" && parsed.resolvedAt === undefined) {
        data.resolvedAt = existing.resolvedAt ?? new Date();
        if ((req as any)?.auth?.sub) data.resolvedBy = (req as any).auth.sub;
      }
      if (parsed.status === "PENDING") {
        data.resolvedAt = null;
        data.resolvedBy = null;
      }
    }

    if (parsed.resolvedAt !== undefined) {
      data.resolvedAt = parsed.resolvedAt;
      if (parsed.resolvedAt === null) data.resolvedBy = null;
    }

    if (parsed.assigneeId !== undefined) {
      if (!parsed.assigneeId) {
        data.assignee = { disconnect: true };
      } else {
        const assignee = await prisma.adminUser.findUnique({
          where: { id: parsed.assigneeId },
          select: { id: true },
        });
        if (!assignee) {
          return res.status(404).json({ ok: false, message: "assignee_not_found" });
        }
        data.assignee = { connect: { id: assignee.id } };
      }
    }

    const updated = await prisma.caseItem.update({
      where: { id: existing.id },
      data,
      include: caseInclude,
    });

    if (becameResolved) {
      await recordCaseStat(updated.botId, "resolved");
    }

    safeBroadcast({
      type: "case:update",
      tenant: updated.tenant,
      botId: updated.botId,
      case: {
        id: updated.id,
        status: updated.status,
        assigneeId: updated.assigneeId,
        resolvedAt: updated.resolvedAt,
        updatedAt: updated.updatedAt,
      },
    });

    return res.json({ ok: true, item: serializeCase(updated) });
  } catch (err) {
    console.error("[PATCH /api/admin/cases/:id]", err);
    if (err instanceof z.ZodError) {
      return res.status(400).json({ ok: false, message: "invalid_input", issues: err.issues });
    }
    return res.status(500).json({ ok: false, message: "internal_error_update_case" });
  }
});

export default router;
