// src/routes/adminFaq.ts
import { Router } from "express";
import { prisma } from "../lib/prisma";  // ← ตรงนี้สำคัญ

export const adminFaqRouter = Router();

// NOTE: ตอนนี้ยังไม่ล็อก tenant จาก token ใช้ค่า fix ไปก่อน
const DEFAULT_TENANT = "bn9";

// GET /api/admin/faq?botId=xxx
adminFaqRouter.get("/faq", async (req, res) => {
  try {
    const tenant = DEFAULT_TENANT;
    const botId = req.query.botId as string | undefined;

    if (!botId) {
      return res
        .status(400)
        .json({ ok: false, message: "botId is required" });
    }

    const items = await prisma.faqEntry.findMany({
      where: { tenant, botId },
      orderBy: { createdAt: "desc" },
    });

    return res.json({ ok: true, items });
  } catch (err) {
    console.error("GET /api/admin/faq error", err);
    return res.status(500).json({ ok: false, message: "internal_error" });
  }
});

// POST /api/admin/faq
adminFaqRouter.post("/faq", async (req, res) => {
  try {
    const tenant = DEFAULT_TENANT;
    const { botId, question, answer, keywords } = req.body || {};

    if (!botId || !question || !answer) {
      return res
        .status(400)
        .json({ ok: false, message: "missing_fields" });
    }

    const keywordString =
      Array.isArray(keywords) && keywords.length > 0
        ? (keywords as string[]).join(", ")
        : (keywords as string | undefined) ?? "";

    const item = await prisma.faqEntry.create({
      data: {
        tenant,
        botId,
        question,
        answer,
        keywords: keywordString,
      },
    });

    return res.json({ ok: true, item });
  } catch (err) {
    console.error("POST /api/admin/faq error", err);
    return res.status(500).json({ ok: false, message: "internal_error" });
  }
});

