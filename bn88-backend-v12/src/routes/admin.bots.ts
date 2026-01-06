// src/routes/admin.bots.ts
import { Router, type Request, type Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma"; // หรือ "../lib/prisma"

const router = Router();

/** PATCH /api/admin/bots/:id — เปลี่ยนชื่อ / active / verifiedAt */
router.patch("/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id || typeof id !== "string") {
    return res.status(400).json({ ok: false, message: "missing_botId" });
  }

  const body = req.body ?? {};
  const data: Prisma.BotUpdateInput = {};

  if (typeof body.name === "string") {
    data.name = body.name.trim().slice(0, 60);
  }
  if (typeof body.active === "boolean") {
    data.active = body.active;
  }
  if (body.verifiedAt === null) {
    data.verifiedAt = null;
  } else if (typeof body.verifiedAt === "string") {
    data.verifiedAt = new Date(body.verifiedAt);
  }

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ ok: false, message: "nothing_to_update" });
  }

  try {
    const bot = await prisma.bot.update({
      where: { id },
      data,
      select: {
        id: true,
        tenant: true,
        name: true,
        platform: true,
        active: true,
        verifiedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.json({ ok: true, bot });
  } catch (err) {
    console.error("PATCH /api/admin/bots/:id error:", err);
    return res.status(404).json({ ok: false, message: "not_found" });
  }
});

/** DELETE /api/admin/bots/:id — ลบบอท (child cascade ตาม schema) */
router.delete("/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id || typeof id !== "string") {
    return res.status(400).json({ ok: false, message: "missing_botId" });
  }

  try {
    await prisma.bot.delete({ where: { id } });
    return res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/admin/bots/:id error:", err);
    return res.status(404).json({ ok: false, message: "not_found" });
  }
});

/** GET /api/admin/bots/:id/secrets — ดึง secrets แบบ masked */
router.get("/:id/secrets", async (req: Request, res: Response) => {
  const botId = req.params.id;
  if (!botId || typeof botId !== "string") {
    return res.status(400).json({ ok: false, message: "missing_botId" });
  }

  try {
    const sec = await prisma.botSecret.findUnique({ where: { botId } });

    return res.json({
      ok: true,
      openaiApiKey: sec?.openaiApiKey ? "********" : "",
      lineAccessToken: sec?.channelAccessToken ? "********" : "",
      lineChannelSecret: sec?.channelSecret ? "********" : "",
    });
  } catch (err) {
    console.error("GET /api/admin/bots/:id/secrets error:", err);
    return res.status(500).json({ ok: false, message: "internal_error" });
  }
});

/** POST /api/admin/bots/:id/secrets — upsert LINE + OpenAI secrets */
router.post("/:id/secrets", async (req: Request, res: Response) => {
  const botId = req.params.id;
  if (!botId || typeof botId !== "string") {
    return res.status(400).json({ ok: false, message: "missing_botId" });
  }

  const {
    openaiApiKey,
    lineAccessToken,
    lineChannelSecret,
  }: {
    openaiApiKey?: string | null;
    lineAccessToken?: string | null;
    lineChannelSecret?: string | null;
  } = req.body ?? {};

  const updateData: Prisma.BotSecretUpdateInput = {};
  if (typeof openaiApiKey === "string" && openaiApiKey.trim()) {
    updateData.openaiApiKey = openaiApiKey.trim();
  }
  if (typeof lineAccessToken === "string" && lineAccessToken.trim()) {
    updateData.channelAccessToken = lineAccessToken.trim();
  }
  if (typeof lineChannelSecret === "string" && lineChannelSecret.trim()) {
    updateData.channelSecret = lineChannelSecret.trim();
  }

  try {
    // เช็คก่อนว่ามี bot นี้จริงไหม
    const bot = await prisma.bot.findUnique({
      where: { id: botId },
      select: { id: true },
    });
    if (!bot) {
      return res.status(404).json({ ok: false, message: "bot_not_found" });
    }

    const existing = await prisma.botSecret.findUnique({ where: { botId } });

    if (existing) {
      if (Object.keys(updateData).length === 0) {
        return res.json({ ok: true, botId }); // ไม่ได้ส่ง field ใหม่มา → ผ่านเฉยๆ
      }
      await prisma.botSecret.update({
        where: { botId },
        data: updateData,
      });
    } else {
      await prisma.botSecret.create({
        data: {
          bot: { connect: { id: botId } },
          openaiApiKey: (updateData as any).openaiApiKey ?? null,
          channelAccessToken: (updateData as any).channelAccessToken ?? null,
          channelSecret: (updateData as any).channelSecret ?? null,
        },
      });
    }

    return res.json({ ok: true, botId });
  } catch (err) {
    console.error("POST /api/admin/bots/:id/secrets error:", err);
    return res.status(500).json({ ok: false, message: "internal_error" });
  }
});

export default router;




