// src/routes/auth.ts
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { config } from "../config";
import { signJwt } from "../lib/jwt";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(3),
});

router.post(
  "/login",
  (req: Request, res: Response): Response => {
    const parsed = loginSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        message: "invalid_input",
        issues: parsed.error.issues,
      });
    }

    const { email, password } = parsed.data;

    // demo login แบบ fix ค่า (ภายหลังค่อยเปลี่ยนมาใช้ AdminUser จริง)
    if (email !== "root@bn9.local" || password !== "bn9@12345") {
      return res
        .status(401)
        .json({ ok: false, message: "invalid_credential" });
    }

    // ใช้ JWT_EXPIRE เป็นหลัก + รองรับ JWT_EXPIRES (เผื่อสะกดผิด)
    const expiresIn = (config.JWT_EXPIRE ??
      (config as any).JWT_EXPIRES ??
      "1d") as string;

    const token = signJwt(
      {
        email,
        roles: ["admin"],
        tenant: "bn9",
      },
      { expiresIn, subject: "admin-api" } as any
    );

    return res.json({ ok: true, token });
  }
);

export default router;
