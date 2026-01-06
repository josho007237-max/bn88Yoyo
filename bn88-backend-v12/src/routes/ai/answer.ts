// src/routes/ai/answer.ts
import { Router, type Request, type Response } from "express";
import { prisma } from "../../lib/prisma";
import { askAI } from "../../services/ai";
import { authGuard } from "../../mw/auth";
import { searchRelevant } from "../../services/knowledge";

type AskBody = {
  botId?: string;
  message?: string;
  limit?: number; // จำนวน knowledge snippets ที่ดึงมาใช้ (ค่าเริ่มต้น 5)
};

const router = Router();

// ต้องมี JWT ก่อน (ใช้ token จาก /auth/login หรือ /api/admin/auth/login)
router.use(authGuard);

/**
 * POST /api/ai/answer
 * body: { botId, message, limit? }
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const tenant = (req.headers["x-tenant"] as string) || "bn9";
    const { botId, message, limit } = (req.body || {}) as AskBody;

    if (!botId || !message) {
      return res.status(400).json({
        ok: false,
        code: "invalid_input",
        message: "botId และ message จำเป็นต้องมี",
      });
    }

    // โหลด bot + config + secret (ตรงกับ Prisma schema: Bot { config, secret })
    const bot = await prisma.bot.findUnique({
      where: { id: botId },
      include: {
        config: true,
        secret: true,
      },
    });

    if (!bot || !bot.config) {
      return res.status(404).json({
        ok: false,
        code: "not_found",
        message: "ไม่พบบอทหรือยังไม่มี config",
      });
    }

    // เลือก OpenAI key จาก BotSecret ก่อน ถ้าไม่มีค่อย fallback ไป ENV
    const apiKey =
      bot.secret?.openaiApiKey || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(400).json({
        ok: false,
        code: "missing_openai_key",
        message:
          "ยังไม่ได้ตั้งค่า OpenAI API Key ใน Bot Secrets และไม่มีค่าใน ENV",
      });
    }

    // ดึง knowledge ที่เกี่ยวข้อง (ถ้าไม่มีจะได้เป็น [])
    const kLimit =
      typeof limit === "number" && limit > 0 && limit <= 20 ? limit : 5;
    const chunks = await searchRelevant(tenant, message, kLimit);

    // เรียก AI ตาม config ของบอท
    const answer = await askAI({
      apiKey,
      model:
        bot.config.model ||
        process.env.OPENAI_MODEL ||
        "gpt-4o-mini",
      systemPrompt:
        bot.config.systemPrompt ||
        "คุณคือผู้ช่วยที่สุภาพ กระชับ และตอบเป็นภาษาไทย",
      temperature: bot.config.temperature ?? 0.4,
      maxTokens: bot.config.maxTokens ?? 400,
      userText: message,
      knowledgeSnippets: chunks.map((c: any) => c.content),
    });

    return res.json({
      ok: true,
      answer,
      context: chunks, // เผื่อ frontend อยากโชว์ว่า AI ใช้ context อะไรบ้าง
    });
  } catch (err: any) {
    console.error("[AI/ANSWER ERROR]", err);
    const msg = err?.message || "internal_error";

    const isKeyError =
      msg === "missing_openai_api_key" || msg === "missing_openai_key";

    return res.status(isKeyError ? 400 : 500).json({
      ok: false,
      code: isKeyError ? "missing_openai_key" : "internal_error",
      message: msg,
    });
  }
});

export default router;

