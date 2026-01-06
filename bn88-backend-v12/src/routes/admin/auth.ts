// src/routes/admin/auth.ts
import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { signJwt } from "../../lib/jwt";
import { config } from "../../config";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type AuthPayload = {
  email: string;
  roles: string[];
  tokenType?: "admin-api";
};

function getExpiresIn(): string | number {
  // รองรับหลายชื่อ config เผื่อโปรเจกต์มีของเก่า
  const cfg = config as any;
  return (config.JWT_EXPIRE ?? cfg.JWT_EXPIRES ?? cfg.JWT_EXPIRE ?? "1d") as
    | string
    | number;
}

function ensureAdminRole(roles: string[]): string[] {
  const lower = new Set(roles.map((r) => String(r).toLowerCase()));

  // ถ้ามี superadmin แต่ไม่มี admin -> เติม Admin
  if (lower.has("superadmin") && !lower.has("admin")) {
    roles = [...roles, "Admin"];
  }

  // กัน roles ว่าง/แปลก -> บังคับมี Admin อย่างน้อย
  if (!lower.has("admin") && !lower.has("superadmin")) {
    roles = [...roles, "Admin"];
  }

  // unique + คงลำดับ
  const seen = new Set<string>();
  return roles.filter((r) => {
    const k = String(r);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

router.post("/login", async (req: Request, res: Response) => {
  try {
    const parsed = loginSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        message: "invalid_input",
        issues: parsed.error.issues,
      });
    }

    const { email, password } = parsed.data;

    // NOTE: ถ้า schema ใช้ passwordHash ให้เปลี่ยน field ตรงนี้
    const user = await prisma.adminUser.findUnique({
      where: { email },
      select: { id: true, email: true, password: true },
    });

    if (!user) {
      return res
        .status(401)
        .json({ ok: false, message: "invalid_credentials" });
    }

    const hash = String(user.password ?? "").trim();
    if (!hash) {
      return res
        .status(401)
        .json({ ok: false, message: "invalid_credentials" });
    }

    const ok = await bcrypt.compare(password, hash);
    if (!ok) {
      return res
        .status(401)
        .json({ ok: false, message: "invalid_credentials" });
    }

    // roles (ถ้ามีระบบ role)
    let roles: string[] = ["Admin"];
    try {
      const roleLinks = await prisma.adminUserRole.findMany({
        where: { adminId: user.id },
        include: { role: true },
      });

      const roleNames = roleLinks
        .map((r) => r.role?.name)
        .filter((x): x is string => Boolean(x));

      if (roleNames.length) roles = roleNames;
    } catch {
      roles = ["Admin"];
    }

    roles = ensureAdminRole(roles);

    const payload: AuthPayload = {
      email: user.email,
      roles,
      tokenType: "admin-api",
    };

    const expiresIn = getExpiresIn();

    // สำคัญ: payload ไม่มี sub => ใช้ subject เป็น user.id
    const token = signJwt(payload, {
      expiresIn: expiresIn as any,
      subject: String(user.id),
    });

    return res.json({
      ok: true,
      token,
      accessToken: token, // เผื่อ FE ใช้ชื่อนี้
      user: { id: user.id, email: user.email, roles },
    });
  } catch (err) {
    console.error("POST /api/admin/auth/login error:", err);
    return res.status(500).json({ ok: false, message: "internal_error" });
  }
});

export default router;

