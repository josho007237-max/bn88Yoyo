// src/routes/admin/personas.ts
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

// GET /api/admin/personas  -> list AiPreset ทั้งหมดของ tenant
router.get("/", async (req: Request, res: Response) => {
  const tenant = getTenant(req);

  const items = await prisma.aiPreset.findMany({
    where: { tenant },
    orderBy: { createdAt: "desc" },
  });

  res.json({ ok: true, items });
});

// GET /api/admin/personas/:id -> รายการเดียว
router.get("/:id", async (req: Request, res: Response) => {
  const tenant = getTenant(req);
  const id = req.params.id;

  const item = await prisma.aiPreset.findFirst({
    where: { id, tenant },
  });

  if (!item) {
    return res
      .status(404)
      .json({ ok: false, code: "not_found", message: "preset not found" });
  }

  res.json({ ok: true, item });
});

// POST /api/admin/personas -> สร้าง preset ใหม่
router.post("/", async (req: Request, res: Response) => {
  const tenant = getTenant(req);
  const body = req.body ?? {};

  const name = body.name as string;
  const description = (body.description as string | undefined) ?? null;
  const systemPrompt = (body.systemPrompt as string | undefined) ?? null;
  const model = (body.model as string | undefined) || "gpt-4o-mini";
  const temperature =
    typeof body.temperature === "number" ? body.temperature : 0.4;
  const topP = typeof body.topP === "number" ? body.topP : 1;
  const maxTokens =
    typeof body.maxTokens === "number" ? body.maxTokens : 800;
  const status = (body.status as string | undefined) || "active";

  if (!name) {
    return res.status(400).json({
      ok: false,
      code: "bad_request",
      message: "name is required",
    });
  }

  const item = await prisma.aiPreset.create({
    data: {
      tenant,
      name,
      description,
      systemPrompt,
      model,
      temperature,
      topP,
      maxTokens,
      status,
    },
  });

  res.status(201).json({ ok: true, item });
});

// PATCH /api/admin/personas/:id -> แก้ไข preset
router.patch("/:id", async (req: Request, res: Response) => {
  const tenant = getTenant(req);
  const id = req.params.id;
  const body = req.body ?? {};

  const data: any = {};

  if (typeof body.name === "string") data.name = body.name;
  if (typeof body.description === "string" || body.description === null)
    data.description = body.description;
  if (typeof body.systemPrompt === "string" || body.systemPrompt === null)
    data.systemPrompt = body.systemPrompt;
  if (typeof body.model === "string") data.model = body.model;
  if (typeof body.temperature === "number") data.temperature = body.temperature;
  if (typeof body.topP === "number") data.topP = body.topP;
  if (typeof body.maxTokens === "number") data.maxTokens = body.maxTokens;
  if (typeof body.status === "string") data.status = body.status;

  const updated = await prisma.aiPreset.updateMany({
    where: { id, tenant },
    data,
  });

  if (updated.count === 0) {
    return res
      .status(404)
      .json({ ok: false, code: "not_found", message: "preset not found" });
  }

  const item = await prisma.aiPreset.findUnique({ where: { id } });

  res.json({ ok: true, item });
});

// DELETE /api/admin/personas/:id -> ปิดการใช้งาน (set status) หรือจะลบจริงก็ได้
router.delete("/:id", async (req: Request, res: Response) => {
  const tenant = getTenant(req);
  const id = req.params.id;
  const body = req.body ?? {};

  const hard = Boolean(body.hardDelete);

  let result;
  if (hard) {
    result = await prisma.aiPreset.deleteMany({
      where: { id, tenant },
    });
  } else {
    result = await prisma.aiPreset.updateMany({
      where: { id, tenant },
      data: { status: "inactive" },
    });
  }

  res.json({ ok: true, result });
});

export default router;
