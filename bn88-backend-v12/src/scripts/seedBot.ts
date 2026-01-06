// src/services/ai.ts

// =======================
// Types
// =======================

export type AskPloyOptions = {
  openaiKey: string;
  userText: string;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
};

export type AskAIOptions = {
  apiKey: string;
  userText: string;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  knowledgeSnippets?: string[]; // ใช้แนบ context เพิ่ม (RAG / KB)
};

// =======================
// Core helpers
// =======================

/**
 * สร้าง messages สำหรับส่งเข้า OpenAI Chat Completions
 * - systemPrompt: ถ้าไม่ส่งมา จะใช้ default persona "พี่พลอย"
 * - knowledgeSnippets: ถ้ามีจะเอามาต่อท้ายเป็นข้อมูลอ้างอิง
 */
function buildMessages(
  systemPrompt: string | undefined,
  userText: string,
  knowledgeSnippets?: string[]
) {
  const baseSystem =
    systemPrompt?.trim() ||
    "คุณคือผู้ช่วยชื่อ 'พี่พลอย' ที่สุภาพ กระชับ พิมพ์ภาษาไทยเป็นหลัก และอธิบายให้เข้าใจง่าย";

  const withKnowledge =
    knowledgeSnippets && knowledgeSnippets.length > 0
      ? `${baseSystem}\n\n# ข้อมูลอ้างอิง\n${knowledgeSnippets
          .map((c, i) => `(${i + 1}) ${c}`)
          .join("\n\n")}`
      : baseSystem;

  return [
    { role: "system", content: withKnowledge },
    { role: "user", content: userText },
  ];
}

// =======================
// askPloy (ใช้กับ LINE webhook)
// =======================

/**
 * ฟังก์ชันหลักที่ LINE webhook ใช้เรียกเวลาให้ "พี่พลอย" ตอบลูกค้า
 * - ไม่โยน error กลับไปที่ webhook (จะ return ข้อความ fallback แทน)
 * - ถ้าไม่มี API key: แจ้งแอดมินให้ไปตั้งค่าในหน้า Bots → Secrets
 */
export async function askPloy({
  model,
  systemPrompt,
  userText,
  openaiKey,
  temperature = 0.3,
  top_p = 0.9,
  max_tokens = 600,
}: AskPloyOptions): Promise<string> {
  if (!openaiKey) {
    return "ตอนนี้ยังไม่ได้ตั้งค่า OpenAI API Key ค่ะ แอดมินลองเช็คหน้า Bots → Secrets นะคะ 💛";
  }

  const finalModel = model || process.env.OPENAI_MODEL || "gpt-4o-mini";

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: finalModel,
        temperature,
        top_p,
        max_tokens,
        messages: buildMessages(systemPrompt, userText),
      }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error("OpenAI error (askPloy):", res.status, txt);
      return "ขอโทษค่ะ ระบบ AI มีปัญหาชั่วคราว ลองใหม่อีกครั้งนะคะ 🙏";
    }

    const data: any = await res.json().catch((e) => {
      console.error("OpenAI JSON parse error (askPloy):", e);
      return null;
    });

    const content: string | undefined =
      data?.choices?.[0]?.message?.content ??
      data?.choices?.[0]?.text ??
      undefined;

    if (!content || typeof content !== "string") {
      console.warn("OpenAI empty content (askPloy):", data);
      return "ขอโทษค่ะ ยังไม่ได้ข้อความตอบกลับจาก AI ค่ะ ลองพิมพ์ใหม่อีกครั้งนะคะ 🙏";
    }

    return content.trim();
  } catch (err) {
    console.error("OpenAI fetch error (askPloy):", err);
    return "ขอโทษค่ะ ระบบ AI มีปัญหาชั่วคราว ลองใหม่อีกครั้งนะคะ 🙏";
  }
}

// =======================
// askAI (ใช้ทั่วไป / Dashboard / Tools อื่น)
// =======================

/**
 * ฟังก์ชัน AI แบบ general-purpose
 * - ใช้ใน Dashboard / dev tools / ฟีเจอร์อื่น
 * - ถ้า error จะ throw ให้ caller handle ต่อเอง
 */
export async function askAI({
  apiKey,
  userText,
  systemPrompt,
  model,
  temperature = 0.3,
  topP = 0.9,
  maxTokens = 600,
  knowledgeSnippets,
}: AskAIOptions): Promise<string> {
  if (!apiKey) {
    throw new Error("missing_openai_api_key");
  }

  const finalModel = model || process.env.OPENAI_MODEL || "gpt-4o-mini";

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: finalModel,
        temperature,
        top_p: topP,
        max_tokens: maxTokens,
        messages: buildMessages(systemPrompt, userText, knowledgeSnippets),
      }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error("OpenAI error (askAI):", res.status, txt);
      throw new Error("internal_error");
    }

    const data: any = await res.json().catch((e) => {
      console.error("OpenAI JSON parse error (askAI):", e);
      throw new Error("internal_error");
    });

    const content: string | undefined =
      data?.choices?.[0]?.message?.content ??
      data?.choices?.[0]?.text ??
      undefined;

    if (!content || typeof content !== "string") {
      console.warn("OpenAI empty content (askAI):", data);
      throw new Error("empty_ai_response");
    }

    return content.trim();
  } catch (err) {
    console.error("OpenAI fetch error (askAI):", err);
    throw err;
  }
}

