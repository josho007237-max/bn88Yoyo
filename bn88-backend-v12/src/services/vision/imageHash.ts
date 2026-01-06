// src/services/vision/imageHash.ts
import sharp from "sharp";

export async function computeAHashHex(buf: Buffer): Promise<string> {
  // aHash 8x8 => 64 bits => hex 16 ตัว
  const raw = await sharp(buf)
    .resize(8, 8, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer();

  let sum = 0;
  for (const v of raw) sum += v;
  const avg = sum / raw.length;

  let bits = 0n;
  for (let i = 0; i < 64; i++) {
    if (raw[i] > avg) bits |= 1n << BigInt(63 - i);
  }
  return bits.toString(16).padStart(16, "0");
}

export function hammingHex64(a: string, b: string): number {
  const x = BigInt("0x" + a) ^ BigInt("0x" + b);
  let n = x;
  let c = 0;
  while (n) {
    n &= n - 1n;
    c++;
  }
  return c;
}
