// src/routes/admin/bot.ai.ts
import { Router, type Request, type Response } from "express";
import { prisma } from "../../lib/prisma";

const router = Router();

/**
 * PATCH /api/admin/bots/:id/config
 * ปรับ config ของบอท (model / systemPrompt / temperature / topP / maxTokens)
 */
router.patch(
  "/bots/:id/config",
  async (
    req: Request<
      { id: string },
      any,
      {
        openaiModel?: string;
        systemPrompt?: string;
        temperature?: number;
        topP?: number;
        maxTokens?: number;
      }
    >,
    res: Response
  ) => {
    try {
      const { id } = req.params;

      // ดึง bot เพื่อตรวจว่ามีอยู่จริง และใช้ tenant ตอนสร้าง BotConfig
      const bot = await prisma.bot.findUnique({
        where: { id },
        select: { id: true, tenant: true },
      });

      if (!bot) {
        return res
          .status(404)
          .json({ ok: false, message: "bot_not_found" });
      }

      const { openaiModel, systemPrompt, temperature, topP, maxTokens } =
        req.body ?? {};

      // upsert BotConfig (ถ้ามีแล้ว → update, ถ้ายังไม่มี → create)
      const config = await prisma.botConfig.upsert({
        where: { botId: id },
        create: {
          botId: id,
          tenant: bot.tenant,
          model: openaiModel ?? "gpt-4o-mini",
          systemPrompt: systemPrompt ?? "",
          temperature: temperature ?? 0.3,
          topP: topP ?? 1,
          maxTokens: maxTokens ?? 800,
        },
        update: {
          // ถ้าไม่ได้ส่งค่าใน body มา → undefined → Prisma จะไม่แตะ field นั้น
          model: openaiModel ?? undefined,
          systemPrompt,
          temperature,
          topP,
          maxTokens,
        },
      });

      return res.json({ ok: true, config });
    } catch (err) {
      console.error("PATCH /api/admin/bots/:id/config error:", err);
      return res.status(500).json({ ok: false, message: "internal_error" });
    }
  }
);

export default router;

