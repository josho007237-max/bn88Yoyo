// src/services/intent.ts
import { prisma } from "../lib/prisma";
import type { BotIntent } from "@prisma/client";

/**
 * ชนิด intent หลักที่ระบบรองรับตอนนี้
 */
export type IntentKind = "deposit" | "withdraw" | "register" | "kyc" | "other";

/**
 * แปลง field keywords ของ BotIntent ให้กลายเป็น string[]
 * - รองรับกรณีเก็บเป็น JSON string เช่น '["ฝาก","เติมเครดิต"]'
 * - ถ้า parse ไม่ได้ หรือไม่ใช่ array → คืน []
 */
function extractKeywords(intent: BotIntent): string[] {
  if (!intent.keywords) return [];

  try {
    // สมมติว่าเก็บเป็น JSON string
    const parsed = JSON.parse(intent.keywords as any);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((v) => typeof v === "string")
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
  } catch {
    // ถ้า parse ไม่ได้ ให้ถือว่า intent นี้ไม่มี keyword
    return [];
  }
}

/**
 * classifyKindFromText
 * --------------------
 * อ่านข้อความของ user แล้วพยายามจัดหมวดเป็น intent หลัก
 * โดยดึง BotIntent ของ tenant + botId นั้น ๆ จาก DB แล้วไล่เช็ก keyword แบบง่าย ๆ
 *
 * กติกา:
 * - ถ้าข้อความว่าง หรือไม่มี intent ใน DB → "other"
 * - ถ้าข้อความมี keyword ของ intent ใด intent หนึ่ง → return intent.code นั้นเลย
 * - code ต้องเป็นหนึ่งใน: "deposit" | "withdraw" | "register" | "kyc" | "other"
 */
export async function classifyKindFromText(
  tenant: string,
  botId: string,
  text: string | null | undefined
): Promise<IntentKind> {
  const raw = (text ?? "").trim();
  if (!raw) {
    return "other";
  }

  const lower = raw.toLowerCase();

  // ดึง intents ของบอทนี้ใน tenant นี้
  const intents = await prisma.botIntent.findMany({
    where: { tenant, botId },
  });

  if (!intents.length) {
    return "other";
  }

  // ไล่เช็กทุก intent ตามลำดับ (ตัวแรกที่ match จะถูกคืน)
  for (const intent of intents) {
    const kws = extractKeywords(intent);
    if (!kws.length) continue;

    for (const kw of kws) {
      if (!kw) continue;
      if (lower.includes(kw.toLowerCase())) {
        // match intent นี้ → คืน code ของ intent
        // (cast เป็น IntentKind เพราะเราควบคุมให้ code เป็นค่ากลุ่มนี้ใน seed/schema)
        return intent.code as IntentKind;
      }
    }
  }

  // ถ้าไม่เข้า intent ไหนเลย
  return "other";
}

