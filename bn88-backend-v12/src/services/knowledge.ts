// src/services/knowledge.ts
import OpenAI from "openai";
import { prisma } from "../lib/prisma";

// ถ้าไม่ได้ตั้ง OPENAI_API_KEY ไว้ ให้ build / search คืนค่าปลอดภัย
const GLOBAL_API_KEY = process.env.OPENAI_API_KEY || "";
const EMBED_MODEL = process.env.OPENAI_EMBED_MODEL || "text-embedding-3-small";

// สร้าง client เฉพาะตอนมี key (กัน error ตอน dev ที่ยังไม่ตั้งค่า)
const openai = GLOBAL_API_KEY ? new OpenAI({ apiKey: GLOBAL_API_KEY }) : null;

/** ตัดเนื้อหาเป็นชิ้นเล็กๆ สำหรับทำดัชนี (size ตัวอักษรต่อชิ้น) */
export function splitChunks(body: string, size = 800): string[] {
  const out: string[] = [];
  let cur = "";

  for (const line of (body || "").split(/\r?\n/)) {
    const next = cur ? cur + "\n" + line : line;
    if (next.length > size) {
      if (cur.trim()) out.push(cur.trim());
      cur = line;
    } else {
      cur = next;
    }
  }

  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** เรียก OpenAI สร้าง embedding ให้ text หลาย ๆ ชิ้น */
export async function embedText(texts: string[]): Promise<number[][]> {
  if (!openai || !GLOBAL_API_KEY) {
    // ถ้าไม่มี key ให้คืนอาเรย์ว่าง แต่ให้ระบบทำงานต่อได้
    return texts.map(() => []);
  }

  const resp = await openai.embeddings.create({
    model: EMBED_MODEL,
    input: texts,
  });

  // @ts-ignore – library type ยังไม่ strict เรื่อง embedding
  return resp.data.map((d) => d.embedding as number[]);
}

/** cosine similarity ระหว่างเวกเตอร์สองตัว */
export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;

  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const x = a[i] ?? 0;
    const y = (b[i] ?? 0) as number;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }

  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9);
}

/**
 * สร้างดัชนีให้เอกสาร 1 ฉบับ
 * - อ่านจากตาราง knowledgeDoc (ถ้ามี)
 * - ตัดเป็น chunks
 * - เขียนลง knowledgeChunk (ถ้ามี)
 */
export async function buildIndexForDoc(docId: string): Promise<number> {
  const doc = await (prisma as any).knowledgeDoc?.findUnique?.({
    where: { id: docId },
  });

  if (!doc) throw new Error("doc not found");

  const chunks = splitChunks(doc.body || "");
  if (!chunks.length) return 0;

  // ใช้ any เพื่อหลบ type เวลา schema ยังไม่สร้างครบ
  const table = (prisma as any).knowledgeChunk;
  if (!table || typeof table.create !== "function") {
    // ยังไม่ได้สร้างตาราง knowledgeChunk → ข้ามไปเงียบ ๆ
    return 0;
  }

  const embs = await embedText(chunks);

  for (let i = 0; i < chunks.length; i++) {
    await table.create({
      data: {
        tenant: doc.tenant,
        docId: doc.id,
        content: chunks[i],
        embedding: (embs[i] as any) ?? [],
        tokens: chunks[i].length,
      },
    });
  }

  return chunks.length;
}

/**
 * ค้นหา knowledge ที่เกี่ยวข้องกับ query
 * - ถ้าไม่มีตาราง knowledgeChunk หรือไม่มี key → คืน []
 */
export async function searchRelevant(
  tenant: string,
  query: string,
  limit = 5
) {
  const table = (prisma as any).knowledgeChunk;
  if (!table || typeof table.findMany !== "function" || !openai || !GLOBAL_API_KEY) {
    return [];
  }

  const [qEmb] = await embedText([query]);

  const items = (await table.findMany({
    where: { tenant },
    orderBy: { updatedAt: "desc" },
    take: 500,
  })) as any[];

  const scored = items.map((it) => ({
    id: it.id,
    docId: it.docId,
    content: it.content as string,
    score: cosine(qEmb, (it.embedding as number[]) || []),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}
