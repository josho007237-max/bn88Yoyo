// src/lib/ai.ts
import OpenAI from "openai";
import { config } from "../config";

let client: OpenAI | null = null;
function getClient(): OpenAI | null {
  if (!config.OPENAI_API_KEY) return null;
  if (!client) client = new OpenAI({ apiKey: config.OPENAI_API_KEY });
  return client;
}

/**
 * ให้ “พี่พลอย BN9” ตอบสั้นๆ สุภาพ โฟกัสงานบริการลูกค้า
 * - ถ้าเป็นคำถามทั่วไป: ตอบเป็นข้อความเดียว (ไม่เกิน 3 บรรทัด)
 * - ถ้าเป็นเคสปัญหา (ฝากไม่เข้า/ถอนไม่ได้/สมัคร): ให้บอกข้อมูลที่ต้องการเก็บอย่างชัดเจน
 */
export async function aiReply(userText: string): Promise<string | null> {
  const cli = getClient();
  if (!cli) return null; // ไม่มี API key → ปล่อยให้ระบบ fallback

  const sys = [
    "คุณคือ 'พี่พลอย BN9' แอดมินแชท บริการลูกค้า สุภาพ กระชับ และเป็นมิตร",
    "หลักการตอบ: 1) ทักทายสั้น 2) สรุปสิ่งที่ผู้ใช้ต้องการ 3) บอกขั้นตอน/ข้อมูลที่ต้องใช้ 4) ปิดด้วยกำลังช่วยเหลือ",
    "ถ้าเป็นเคส 'ฝากไม่เข้า' ให้ขอ USER, เบอร์, ธนาคาร, เลขบัญชี, เวลา, สลิป",
    "ถ้าเป็นเคส 'ถอนไม่ได้' ให้ขอ USER, เบอร์, ธนาคาร, เลขบัญชี, สลิป",
    "ตอบภาษาไทย ไม่เกิน 3 บรรทัด",
  ].join("\n");

  try {
    // ใช้ Responses API (รุ่นใหม่) หรือจะใช้ chat.completions ก็ได้
    const res = await cli.responses.create({
      model: config.OPENAI_MODEL,
      input: [
        { role: "system", content: sys },
        { role: "user", content: userText },
      ],
    });

    // ดึงข้อความตอบกลับแบบปลอดภัย
    const out =
      res.output_text?.trim() ||
      (res as any).choices?.[0]?.message?.content?.[0]?.text?.trim() ||
      "";
    return out || null;
  } catch (err) {
    console.warn("[AI reply error]", err);
    return null;
  }
}
