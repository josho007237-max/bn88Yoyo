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
  knowledgeSnippets?: string[]; // ใช้แนบ context เพิ่ม
};

// =======================
// Core helpers
// =======================

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

    const data: any = await res.json();
    return (
      data?.choices?.[0]?.message?.content?.trim() ??
      "ขอโทษค่ะ ยังไม่ได้ข้อความตอบกลับจาก AI ค่ะ"
    );
  } catch (err) {
    console.error("OpenAI fetch error (askPloy):", err);
    return "ขอโทษค่ะ ระบบ AI มีปัญหาชั่วคราว ลองใหม่อีกครั้งนะคะ 🙏";
  }
}

// =======================
// askAI (ใช้ทั่วไป / Dashboard)
// =======================

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

  const data: any = await res.json();
  return (
    data?.choices?.[0]?.message?.content?.trim() ??
    "ขอโทษค่ะ ยังไม่ได้ข้อความตอบกลับจาก AI ค่ะ"
  );
}
