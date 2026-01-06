// src/services/vision/classifyImage.ts
import OpenAI from "openai";
import { toDataUrlFromMaybePath } from "./toDataUrlFromMaybePath.js";

export const ImageClass = {
  ACTIVITY: "ACTIVITY",
  SLIP: "SLIP",
  OTHER: "OTHER",
  REVIEW: "REVIEW",
} as const;

export type ImageClass = (typeof ImageClass)[keyof typeof ImageClass];

export type ImageClassResult = {
  classification: ImageClass;
  confidence: number; // 0..1
  reason?: string;
  raw?: any;
};

// ✅ ไม่พิมพ์ type เป็น OpenAI (กัน TS2709)
let _client: any = null;

function getClient(): any {
  if (_client) return _client;

  const apiKey =
    process.env.OPENAI_API_KEY ||
    process.env.OPENAI_KEY ||
    process.env.OPENAI_SECRET_KEY;

  if (!apiKey) throw new Error("OPENAI_API_KEY_MISSING");

  _client = new OpenAI({ apiKey });
  return _client;
}

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function normalizeClass(v: any): ImageClass {
  const cls = String(v || "REVIEW").toUpperCase();
  if (cls === "ACTIVITY") return ImageClass.ACTIVITY;
  if (cls === "SLIP") return ImageClass.SLIP;
  if (cls === "OTHER") return ImageClass.OTHER;
  return ImageClass.REVIEW;
}

function stripCodeFence(s: string) {
  const t = String(s || "").trim();
  if (!t) return "";
  if (t.startsWith("```")) {
    return t
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/i, "")
      .trim();
  }
  return t;
}

function tryParseJson(s: string): any {
  const t = stripCodeFence(s);
  if (!t) return null;

  try {
    return JSON.parse(t);
  } catch {
    // เผื่อโมเดลมีข้อความนำหน้า/ตามหลัง ให้ดึงช่วง {...}
    const a = t.indexOf("{");
    const b = t.lastIndexOf("}");
    if (a >= 0 && b > a) {
      const mid = t.slice(a, b + 1);
      try {
        return JSON.parse(mid);
      } catch {
        return null;
      }
    }
    return null;
  }
}

// ✅ รองรับ 2 signature: ({imageDataUrl|imageUrl|url,text}) หรือ (imageRef, text)
export async function classifyImageWithOpenAI(
  input:
    | {
        imageDataUrl?: string;
        imageUrl?: string;
        url?: string;
        text?: string;
      }
    | string,
  maybeText?: string
): Promise<ImageClassResult> {
  const text =
    typeof input === "string" ? (maybeText ?? "") : (input.text ?? "");

  const rawRef =
    typeof input === "string"
      ? input
      : (input.imageDataUrl ?? input.imageUrl ?? input.url ?? "");

  // ✅ แปลง ref/path/url -> dataURL ก่อนเสมอ
  let imageDataUrl = "";
  try {
    imageDataUrl = await toDataUrlFromMaybePath(String(rawRef || ""));
  } catch (e: any) {
    return {
      classification: ImageClass.REVIEW,
      confidence: 0,
      reason: "IMAGE_CONVERT_FAILED",
      raw: { err: String(e?.message || e), rawRef },
    };
  }

  if (!imageDataUrl || String(imageDataUrl).length < 20) {
    return {
      classification: ImageClass.REVIEW,
      confidence: 0,
      reason: "IMAGE_EMPTY",
      raw: { rawRef },
    };
  }

  const client = getClient();
  const model =
    process.env.OPENAI_VISION_MODEL ||
    process.env.OPENAI_MODEL ||
    "gpt-4o-mini";

  const system = `
คุณคือระบบคัดแยกรูป “หลักฐานกิจกรรม”
ให้ตอบ JSON เท่านั้น ห้ามมีข้อความอื่น
รูปแบบ:
{
  "classification": "ACTIVITY" | "SLIP" | "OTHER" | "REVIEW",
  "confidence": 0-1,
  "reason": "เหตุผลสั้นๆ"
}

กติกา:
- ACTIVITY = เห็นหลักฐานกิจกรรมชัดเจน
- SLIP = สลิปฝาก/โอน/ธุรกรรม
- OTHER = รูปทั่วไป ไม่เกี่ยว
- REVIEW = ไม่ชัวร์/ให้แอดมินดู
`.trim();

  try {
    const completion = await client.chat.completions.create({
      model,
      temperature: 0,
      max_tokens: 250,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            { type: "text", text: `ข้อความประกอบรูป: ${text || ""}` },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ] as any,
        },
      ],
    });

    const rawText = completion?.choices?.[0]?.message?.content ?? "";
    const parsed = tryParseJson(String(rawText)) || {};

    const classification = normalizeClass(parsed.classification);
    const confidence = clamp01(Number(parsed.confidence ?? parsed.score ?? 0));
    const reason =
      typeof parsed.reason === "string" ? parsed.reason : String(rawText || "");

    return {
      classification,
      confidence,
      reason: reason.slice(0, 300),
      raw: { parsed, model },
    };
  } catch (e: any) {
    return {
      classification: ImageClass.REVIEW,
      confidence: 0,
      reason: "OPENAI_CALL_FAILED",
      raw: { err: String(e?.message || e), model },
    };
  }
}
