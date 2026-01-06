// src/routes/bots.ts
import { Router, type Request, type Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

const router = Router();

/** ---- helpers ---- */
function getTenant(req: Request): string {
  const t = (req.header("x-tenant") || "").trim();
  return t || "bn9";
}
const isMasked = (v?: unknown) =>
  typeof v === "string" && /^\*+$/.test(v.trim());

const baseSelect = {
  id: true,
  tenant: true,
  name: true,
  platform: true,
  active: true,
  verifiedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.BotSelect;

/* =============================================================================
 * GET /api/bots — รายชื่อบอททั้งหมดของ tenant (ใหม่สุดอยู่ล่างสุดเพื่อคงที่)
 * ========================================================================== */
router.get("/", async (req: Request, res: Response) => {
  try {
    const tenant = getTenant(req);
    const items = await prisma.bot.findMany({
      where: { tenant },
      orderBy: { createdAt: "asc" },
      select: baseSelect,
    });
    return res.json({ ok: true, items });
  } catch (err) {
    console.error("GET /api/bots error:", err);
    return res.status(500).json({ ok: false, message: "internal_error" });
  }
});

/* =============================================================================
 * POST /api/bots/init — init / create bot ใหม่
 *  - รับ platform จาก body: line / telegram / facebook (default = line)
 *  - นับบอทต่อ platform แล้วตั้งชื่อให้ เช่น:
 *      LINE      → admin-bot-001, Bot #2, Bot #3, ...
 *      telegram  → Bot telegram #1, Bot telegram #2, ...
 *      facebook  → Bot facebook #1, ...
 *  - แก้เคสชื่อชน (P2002) โดยต่อท้ายเลขเวลาแล้วสร้างใหม่
 * ========================================================================== */
router.post("/init", async (req: Request, res: Response) => {
  const tenant = getTenant(req);

  // อ่าน platform จาก body (ถ้าไม่ส่งมาหรือส่งมั่ว → ใช้ line)
  const rawPlatform =
    req.body && typeof (req.body as any).platform === "string"
      ? (req.body as any).platform
      : "line";

  const platform: "line" | "telegram" | "facebook" =
    rawPlatform === "telegram" || rawPlatform === "facebook"
      ? rawPlatform
      : "line";

  try {
    // นับจำนวนบอทของ tenant + platform นี้
    const count = await prisma.bot.count({ where: { tenant, platform } });

    // ตั้งชื่อเริ่มต้นตาม platform
    const baseName =
      platform === "line"
        ? count === 0
          ? "admin-bot-001"
          : `Bot #${count + 1}`
        : count === 0
        ? `Bot ${platform} #1`
        : `Bot ${platform} #${count + 1}`;

    let name = baseName;

    try {
      // ลองสร้างด้วยชื่อปกติก่อน
      const bot = await prisma.bot.create({
        data: { tenant, platform, name, active: true },
        select: baseSelect,
      });

      return res.json({ ok: true, bot });
    } catch (e: any) {
      // ถ้าเจอ error ซ้ำชื่อ (unique constraint tenant+name)
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        // กรณีชื่อชน → ต่อท้ายเลขเวลาให้ไม่ซ้ำ แล้วลองสร้างใหม่อีกรอบ
        name = `${baseName} (${Date.now().toString().slice(-4)})`;

        const bot = await prisma.bot.create({
          data: { tenant, platform, name, active: true },
          select: baseSelect,
        });

        return res.json({ ok: true, bot });
      }

      throw e;
    }
  } catch (e: any) {
    console.error("POST /api/bots/init error:", e);
    return res.status(500).json({ ok: false, message: "create_failed" });
  }
});

/* =============================================================================
 * GET /api/bots/:id — ดึงข้อมูลบอทตัวเดียว (ตรวจ tenant)
 * ========================================================================== */
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const tenant = getTenant(req);
    const id = String(req.params.id || "");
    if (!id)
      return res.status(400).json({ ok: false, message: "missing_botId" });

    const bot = await prisma.bot.findFirst({
      where: { id, tenant },
      select: baseSelect,
    });
    if (!bot)
      return res.status(404).json({ ok: false, message: "bot_not_found" });

    return res.json({ ok: true, bot });
  } catch (err) {
    console.error("GET /api/bots/:id error:", err);
    return res.status(500).json({ ok: false, message: "internal_error" });
  }
});

/* =============================================================================
 * PATCH /api/bots/:id — เปลี่ยนชื่อ/สถานะ (ตรวจ tenant)
 * body: { name?: string | null, active?: boolean, verifiedAt?: string | null }
 * ========================================================================== */
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const tenant = getTenant(req);
    const id = String(req.params.id || "");
    if (!id)
      return res.status(400).json({ ok: false, message: "missing_botId" });

    const body = req.body ?? {};
    const data: Prisma.BotUpdateInput = {};

    if (typeof body.name === "string")
      data.name = body.name.trim().slice(0, 60);
    if (typeof body.active === "boolean") data.active = body.active;
    if (body.verifiedAt === null) data.verifiedAt = null;
    if (typeof body.verifiedAt === "string")
      data.verifiedAt = new Date(body.verifiedAt);

    if (Object.keys(data).length === 0) {
      return res
        .status(400)
        .json({ ok: false, message: "nothing_to_update" });
    }

    // ตรวจ tenant ก่อน
    const exist = await prisma.bot.findFirst({
      where: { id, tenant },
      select: { id: true },
    });
    if (!exist)
      return res.status(404).json({ ok: false, message: "bot_not_found" });

    const bot = await prisma.bot.update({
      where: { id },
      data,
      select: baseSelect,
    });
    return res.json({ ok: true, bot });
  } catch (err) {
    console.error("PATCH /api/bots/:id error:", err);
    return res.status(500).json({ ok: false, message: "update_failed" });
  }
});

/* =============================================================================
 * DELETE /api/bots/:id — ลบบอท (child จะ cascade ตาม schema) (ตรวจ tenant)
 * ========================================================================== */
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const tenant = getTenant(req);
    const id = String(req.params.id || "");
    if (!id)
      return res.status(400).json({ ok: false, message: "missing_botId" });

    const exist = await prisma.bot.findFirst({
      where: { id, tenant },
      select: { id: true },
    });
    if (!exist)
      return res.status(404).json({ ok: false, message: "bot_not_found" });

    await prisma.bot.delete({ where: { id } });
    return res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/bots/:id error:", err);
    return res.status(500).json({ ok: false, message: "delete_failed" });
  }
});

/* =============================================================================
 * GET /api/bots/:id/secrets — ดึง secrets แบบ masked (ตรวจ tenant)
 * ========================================================================== */
router.get("/:id/secrets", async (req: Request, res: Response) => {
  try {
    const tenant = getTenant(req);
    const id = String(req.params.id || "");
    if (!id)
      return res.status(400).json({ ok: false, message: "missing_botId" });

    const exist = await prisma.bot.findFirst({
      where: { id, tenant },
      select: { id: true },
    });
    if (!exist)
      return res.status(404).json({ ok: false, message: "bot_not_found" });

    const sec = await prisma.botSecret.findUnique({ where: { botId: id } });

    return res.json({
      ok: true,
      openaiApiKey: sec?.openaiApiKey ? "********" : "",
      lineAccessToken: sec?.channelAccessToken ? "********" : "",
      lineChannelSecret: sec?.channelSecret ? "********" : "",
    });
  } catch (err) {
    console.error("GET /api/bots/:id/secrets error:", err);
    return res.status(500).json({ ok: false, message: "internal_error" });
  }
});

/* =============================================================================
 * POST /api/bots/:id/secrets — อัปเดต/สร้าง secrets (ตรวจ tenant)
 * - จะอัปเดตเฉพาะฟิลด์ที่ส่งมาและ **ไม่ใช่** mask (`********`)
 * body: { openaiApiKey?, lineAccessToken?, lineChannelSecret? }
 * ========================================================================== */
router.post("/:id/secrets", async (req: Request, res: Response) => {
  try {
    const tenant = getTenant(req);
    const id = String(req.params.id || "");
    if (!id)
      return res.status(400).json({ ok: false, message: "missing_botId" });

    const exist = await prisma.bot.findFirst({
      where: { id, tenant },
      select: { id: true },
    });
    if (!exist)
      return res.status(404).json({ ok: false, message: "bot_not_found" });

    const { openaiApiKey, lineAccessToken, lineChannelSecret } =
      (req.body ?? {}) as {
        openaiApiKey?: string | null;
        lineAccessToken?: string | null;
        lineChannelSecret?: string | null;
      };

    const updateData: Prisma.BotSecretUpdateInput = {};
    if (
      typeof openaiApiKey === "string" &&
      openaiApiKey.trim() &&
      !isMasked(openaiApiKey)
    ) {
      updateData.openaiApiKey = openaiApiKey.trim();
    }
    if (
      typeof lineAccessToken === "string" &&
      lineAccessToken.trim() &&
      !isMasked(lineAccessToken)
    ) {
      updateData.channelAccessToken = lineAccessToken.trim();
    }
    if (
      typeof lineChannelSecret === "string" &&
      lineChannelSecret.trim() &&
      !isMasked(lineChannelSecret)
    ) {
      updateData.channelSecret = lineChannelSecret.trim();
    }

    const existing = await prisma.botSecret.findUnique({
      where: { botId: id },
    });
    if (existing) {
      if (Object.keys(updateData).length > 0) {
        await prisma.botSecret.update({
          where: { botId: id },
          data: updateData,
        });
      }
    } else {
      await prisma.botSecret.create({
        data: {
          bot: { connect: { id } },
          openaiApiKey:
            (updateData as any).openaiApiKey ??
            (isMasked(openaiApiKey) ? null : openaiApiKey ?? null),
          channelAccessToken:
            (updateData as any).channelAccessToken ??
            (isMasked(lineAccessToken) ? null : lineAccessToken ?? null),
          channelSecret:
            (updateData as any).channelSecret ??
            (isMasked(lineChannelSecret) ? null : lineChannelSecret ?? null),
        },
      });
    }

    return res.json({ ok: true, botId: id });
  } catch (err) {
    console.error("POST /api/bots/:id/secrets error:", err);
    return res.status(500).json({ ok: false, message: "internal_error" });
  }
});

export default router;

