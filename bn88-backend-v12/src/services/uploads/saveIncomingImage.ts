// src/services/uploads/saveIncomingImage.ts
import path from "node:path";
import fs from "node:fs/promises";

function extFromContentType(contentType: string) {
  const ct = (contentType || "").toLowerCase();
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("gif")) return "gif";
  return "jpg";
}

export async function saveIncomingImage(args: {
  buffer: Buffer;
  contentType: string;
  tenant: string;
  botId: string;
  platform: string; // "line"
  messageId: string;
}): Promise<{ publicUrl: string; relPath: string }> {
  const ext = extFromContentType(args.contentType);
  const fileName = `${args.platform}_${args.messageId}.${ext}`;

  // เก็บไว้ใน: <project>/uploads/incoming/<tenant>/<botId>/
  const dir = path.join(
    process.cwd(),
    "uploads",
    "incoming",
    args.tenant,
    args.botId
  );
  await fs.mkdir(dir, { recursive: true });

  const absPath = path.join(dir, fileName);
  await fs.writeFile(absPath, args.buffer);

  // URL สำหรับเรียกไฟล์ (ต้องมี express static เสิร์ฟ /uploads)
  const relPath = `/uploads/incoming/${args.tenant}/${args.botId}/${fileName}`;
  const base = process.env.PUBLIC_BASE_URL || ""; // เช่น https://api.bn9.me
  const publicUrl = base ? `${base}${relPath}` : relPath;

  return { publicUrl, relPath };
}

