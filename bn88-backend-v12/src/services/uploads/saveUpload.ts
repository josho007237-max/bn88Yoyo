// src/services/uploads/saveUpload.ts
import fs from "node:fs/promises";
import path from "node:path";

function extFromMime(mime: string) {
  const m = mime.toLowerCase();
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  if (m.includes("png")) return "png";
  if (m.includes("webp")) return "webp";
  if (m.includes("gif")) return "gif";
  return "bin";
}

export async function saveUploadBuffer(opts: {
  tenant: string;
  platform: "line" | "telegram" | "facebook" | string;
  buffer: Buffer;
  mime: string;
  fileBaseName?: string; // เช่น messageId
}): Promise<{ publicUrl: string; absPath: string }> {
  const { tenant, platform, buffer, mime } = opts;
  const ext = extFromMime(mime);

  const dirAbs = path.join(process.cwd(), "uploads", platform, tenant);
  await fs.mkdir(dirAbs, { recursive: true });

  const safeBase =
    (opts.fileBaseName || "img").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 50) ||
    "img";

  const fileName = `${Date.now()}_${safeBase}.${ext}`;
  const absPath = path.join(dirAbs, fileName);

  await fs.writeFile(absPath, buffer);

  // คุณ serve ไว้แล้ว: app.use("/uploads", express.static(...))
  const publicUrl = `/uploads/${platform}/${tenant}/${fileName}`;
  return { publicUrl, absPath };
}

