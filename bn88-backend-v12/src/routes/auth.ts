// src/routes/admin/auth.ts
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { config } from "../config";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

async function getJwt() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("jsonwebtoken") as typeof import("jsonwebtoken");
  } catch {
    throw new Error("missing jsonwebtoken");
  }
}

async function getBcrypt() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("bcryptjs") as typeof import("bcryptjs");
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("bcryptjs") as typeof import("bcryptjs");
  }
}

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ ok: false, message: "invalid_input" });
  }

  // tenant (บังคับตามระบบของคุณ)
  const tenant = String(req.header("x-tenant") || "").trim();
  if (!tenant) {
    return res.status(401).json({ ok: false, message: "unauthorized" });
  }

  const email = parsed.data.email.toLowerCase().trim();
  const password = parsed.data.password;

  const admin = await prisma.adminUser.findUnique({
    where: { email },
    include: { roles: true },
  });

  if (!admin?.password) {
    return res.status(401).json({ ok: false, message: "unauthorized" });
  }

  const bcrypt = await getBcrypt();
  const ok = await bcrypt.compare(password, admin.password);
  if (!ok) {
    return res.status(401).json({ ok: false, message: "unauthorized" });
  }

  const jwt = await getJwt();

  const secret =
    (config as any).JWT_SECRET ||
    (config as any).ADMIN_JWT_SECRET ||
    process.env.JWT_SECRET ||
    process.env.ADMIN_JWT_SECRET;

  if (!secret) {
    return res.status(500).json({ ok: false, message: "missing_jwt_secret" });
  }

  const roleNames = (admin.roles || []).map(
    (r: any) => r.name || r.code || r.id
  );

  const token = jwt.sign(
    {
      sub: admin.id,
      adminId: admin.id,
      email: admin.email,
      roles: roleNames,
      tenant,
      type: "admin",
    },
    secret,
    { expiresIn: "7d" }
  );

  return res.json({
    ok: true,
    token,
    admin: {
      id: admin.id,
      email: admin.email,
      roles: roleNames,
      tenant,
    },
  });
});

export default router;

