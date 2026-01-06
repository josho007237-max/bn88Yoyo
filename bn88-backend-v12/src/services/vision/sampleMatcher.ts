// src/services/vision/sampleMatcher.ts
import { prisma } from "../../lib/prisma.js";
import { computeAHashHex, hammingHex64 } from "./imageHash.js";

export async function matchImageSample(params: {
  tenant: string;
  botId: string;
  imageBuffer: Buffer;
  maxDist?: number; // แนะนำ 10
}) {
  const { tenant, botId, imageBuffer } = params;
  const maxDist = params.maxDist ?? 10;

  const ahash = await computeAHashHex(imageBuffer);

  const samples = await prisma.imageSample.findMany({
    where: { tenant, botId, isActive: true },
    select: { id: true, label: true, ahash: true, note: true },
  });

  let best: any = null;
  let bestDist = 999;

  for (const s of samples) {
    const d = hammingHex64(ahash, s.ahash);
    if (d < bestDist) {
      bestDist = d;
      best = s;
    }
  }

  if (best && bestDist <= maxDist) {
    return {
      hit: true as const,
      sampleId: best.id,
      label: String(best.label).toUpperCase(),
      confidence: 0.99,
      reason: `MATCH_SAMPLE(dist=${bestDist})`,
      note: best.note ?? null,
      ahash,
      bestDist,
    };
  }

  return { hit: false as const, ahash, bestDist };
}
