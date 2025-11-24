import { Router } from "express";
import { prisma } from "../lib/prisma";   // ถ้าพี่เก็บไว้ที่ src/db/prisma.ts → "../lib/prisma"
import { authGuard } from "../mw/auth";

const r = Router();
r.use(authGuard);

const mask = (v?: string | null) => {
  if (!v) return null;
  return v.length <= 6 ? "*".repeat(v.length) : v.slice(0,3) + "***" + v.slice(-3);
};

r.get("/:id/summary", async (req, res) => {
  const id = req.params.id;
  const bot = await prisma.bot.findUnique({
    where: { id },
    include: { config: true, secret: true },   // ✅ เปลี่ยน secrets → secret
  });
  if (!bot) {
    return res
      .status(404)
      .json({ ok: false, code: "not_found", message: "bot not found" });
  }

  const secrets = bot.secret
    ? {
        channelSecret: mask(bot.secret.channelSecret ?? null),
        channelAccessToken: mask(bot.secret.channelAccessToken ?? null),
        openaiApiKey: mask(bot.secret.openaiApiKey ?? null),
      }
    : null;

  res.json({
    ok: true,
    bot: { id: bot.id, name: bot.name, platform: bot.platform },
    config: bot.config,
    secrets,
  });
});

export default r;


