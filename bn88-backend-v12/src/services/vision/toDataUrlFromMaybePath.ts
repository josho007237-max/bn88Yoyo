import fs from "node:fs/promises";
import path from "node:path";
import { Buffer } from "node:buffer";

function guessMimeByExt(fp: string) {
  const ext = path.extname(fp).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

export async function toDataUrlFromMaybePath(
  imageRef: string
): Promise<string> {
  if (!imageRef) throw new Error("IMAGE_REF_EMPTY");
  if (imageRef.startsWith("data:")) return imageRef;
  if (/^https?:\/\//i.test(imageRef)) return imageRef;

  const rel = imageRef.replace(/^\//, "");
  const abs = path.isAbsolute(imageRef)
    ? imageRef
    : path.join(process.cwd(), rel);

  const buf = await fs.readFile(abs); // Buffer/Uint8Array ได้หมด
  const mime = guessMimeByExt(abs);

  return `data:${mime};base64,${Buffer.from(buf).toString("base64")}`;
}
