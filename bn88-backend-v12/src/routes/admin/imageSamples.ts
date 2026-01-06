// src/routes/admin/imageSamples.ts
import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";

import { prisma } from "../../lib/prisma.js";
import { computeAHashHex } from "../../services/vision/imageHash.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

function getTenant(req: any) {
  return String(req.headers["x-tenant"] || "bn9");
}

function extFromMime(mime?: string | null) {
  const m = String(mime || "").toLowerCase();
  if (m.includes("png")) return ".png";
  if (m.includes("webp")) return ".webp";
  if (m.includes("gif")) return ".gif";
  return ".jpg";
}

function ensureUploadsDir() {
  const dir = path.resolve(process.cwd(), "uploads", "image-samples");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export const imageSamplesRouter = express.Router();

/**
 * GET /admin/image-samples?botId=...&label=...
 */
imageSamplesRouter.get("/", async (req, res) => {
  const tenant = getTenant(req);
  const botId = String(req.query.botId || "");
  const label = String(req.query.label || "").trim();

  if (!botId)
    return res.status(400).json({ ok: false, error: "botId_required" });

  const where: any = { tenant, botId, isActive: true };
  if (label) where.label = label.toUpperCase();

  const items = await prisma.imageSample.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      tenant: true,
      botId: true,
      label: true,
      note: true,
      ahash: true,
      mime: true,
      size: true,
      isActive: true,
      createdAt: true,
    },
  });

  return res.json({ ok: true, items });
});

/**
 * POST /admin/image-samples
 * form-data: botId, label, note?, files[]
 */
imageSamplesRouter.post(
  "/",
  upload.array("files", 20),
  async (req: any, res) => {
    const tenant = getTenant(req);
    const botId = String(req.body?.botId || "").trim();
    const label = String(req.body?.label || "")
      .trim()
      .toUpperCase();
    const note = String(req.body?.note || "").trim() || null;

    if (!botId)
      return res.status(400).json({ ok: false, error: "botId_required" });
    if (!label)
      return res.status(400).json({ ok: false, error: "label_required" });

    const files: Express.Multer.File[] = (req.files || []) as any;
    if (!files.length)
      return res.status(400).json({ ok: false, error: "files_required" });

    const outDir = ensureUploadsDir();

    const created: any[] = [];

    for (const f of files) {
      const ahash = await computeAHashHex(f.buffer);

      const ext = extFromMime(f.mimetype);
      const filename = `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`;
      const abs = path.join(outDir, filename);
      fs.writeFileSync(abs, f.buffer);

      const filePath = path
        .join("uploads", "image-samples", filename)
        .replace(/\\/g, "/");

      const row = await prisma.imageSample.create({
        data: {
          tenant,
          botId,
          label,
          ahash,
          note: note || f.originalname || null,
          filePath,
          mime: f.mimetype || null,
          size: f.size || null,
        },
        select: {
          id: true,
          tenant: true,
          botId: true,
          label: true,
          note: true,
          ahash: true,
          mime: true,
          size: true,
          createdAt: true,
        },
      });

      created.push(row);
    }

    return res.json({ ok: true, createdCount: created.length, items: created });
  }
);

/**
 * GET /admin/image-samples/:id/blob
 */
imageSamplesRouter.get("/:id/blob", async (req, res) => {
  const tenant = getTenant(req);
  const id = String(req.params.id || "");

  const row = await prisma.imageSample.findFirst({
    where: { id, tenant },
    select: { filePath: true, mime: true },
  });

  if (!row?.filePath) return res.status(404).end();

  const abs = path.resolve(process.cwd(), row.filePath);
  if (!fs.existsSync(abs)) return res.status(404).end();

  res.setHeader("Content-Type", row.mime || "image/jpeg");
  fs.createReadStream(abs).pipe(res);
});

/**
 * DELETE /admin/image-samples/:id  (soft delete)
 */
imageSamplesRouter.delete("/:id", async (req, res) => {
  const tenant = getTenant(req);
  const id = String(req.params.id || "");

  await prisma.imageSample.updateMany({
    where: { id, tenant },
    data: { isActive: false },
  });

  return res.json({ ok: true });
});
