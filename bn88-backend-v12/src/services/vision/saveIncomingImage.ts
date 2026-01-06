// src/services/vision/saveIncomingImage.ts
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

function extFromContentType(ct: string) {
  const c = (ct || "").toLowerCase();
  if (c.includes("png")) return "png";
  if (c.includes("webp")) return "webp";
  if (c.includes("gif")) return "gif";
  if (c.includes("jpeg") || c.includes("jpg")) return "jpg";
  return "bin";
}

export async function saveIncomingImage(params: {
  tenant: string;
  botId: string;
  platform: string; // "line" | "telegram" | ...
  userId: string;
  messageId?: string;
  buffer: Buffer;
  contentType: string;
}): Promise<{ imageUrl: string; diskPath: string; fileName: string }> {
  const { tenant, botId, platform, buffer, contentType } = params;

  const ext = extFromContentType(contentType);
  const fileName = `${Date.now()}_${randomUUID()}.${ext}`;

  // ใช้ posix เพื่อให้ URL เป็น /
  const relPosix = [
    "uploads",
    "intake",
    platform,
    tenant,
    botId,
    fileName,
  ].join("/");
  const abs = path.join(process.cwd(), ...relPosix.split("/"));

  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, buffer);

  // URL ที่ FE เปิดได้ (ต้องมี static serve /uploads)
  const imageUrl = `/${relPosix}`;
  return { imageUrl, diskPath: abs, fileName };
}

