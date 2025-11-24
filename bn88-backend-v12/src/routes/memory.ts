// src/routes/memory.ts
import { Router, type Request, type Response } from "express";
import { prisma } from "../lib/prisma";
import { authGuard } from "../mw/auth";

const r = Router();
r.use(authGuard);

function getTenant(req: Request): string {
  const h = (req.header("x-tenant") || "").trim();
  return h || "bn9";
}

/**
 * POST /api/memory/set
 * body: { userRef, key, value, ttlSec?, tags? }
 */
r.post("/set", async (req: Request, res: Response) => {
  try {
    const tenant = getTenant(req);
    const { userRef, key, value, ttlSec, tags } = (req.body ?? {}) as any;

    if (!userRef || !key) {
      return res
        .status(400)
        .json({ ok: false, message: "userRef/key required" });
    }

    const item = await prisma.memoryItem.upsert({
      where: {
        tenant_userRef_key: {
          tenant,
          userRef,
          key,
        },
      },
      update: {
        value: String(value ?? ""),
        ttlSec: typeof ttlSec === "number" ? ttlSec : null,
        tags: Array.isArray(tags) ? tags.map(String) : [],
      },
      create: {
        tenant,
        userRef,
        key,
        value: String(value ?? ""),
        ttlSec: typeof ttlSec === "number" ? ttlSec : null,
        tags: Array.isArray(tags) ? tags.map(String) : [],
      },
    });

    return res.json({ ok: true, item });
  } catch (e) {
    console.error("[POST /memory/set]", e);
    return res.status(500).json({ ok: false, message: "internal_error" });
  }
});

/**
 * GET /api/memory/get?userRef=&key=
 */
r.get("/get", async (req: Request, res: Response) => {
  try {
    const tenant = getTenant(req);
    const userRef = (req.query.userRef as string) || "";
    const key = (req.query.key as string) || "";
    if (!userRef || !key) {
      return res
        .status(400)
        .json({ ok: false, message: "userRef/key required" });
    }

    const item = await prisma.memoryItem.findFirst({
      where: { tenant, userRef, key },
    });

    if (!item) return res.json({ ok: true, item: null });

    return res.json({ ok: true, item });
  } catch (e) {
    console.error("[GET /memory/get]", e);
    return res.status(500).json({ ok: false, message: "internal_error" });
  }
});

export default r;
