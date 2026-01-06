// src/scripts/seedDev.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.DEV_ADMIN_EMAIL || "admin@bn9.local";
  const password = process.env.DEV_ADMIN_PASSWORD || "admin123";

  const hash = await bcrypt.hash(password, 10);

  const admin = await prisma.adminUser.upsert({
    where: { email },
    update: { password: hash },
    create: { email, password: hash },
    select: { id: true, email: true },
  });

  // ถ้ามีระบบ Role/AdminUserRole ใน schema: ผูก superadmin ให้เลย (ถ้าไม่มีจะข้าม)
  try {
    const role = await prisma.role.upsert({
      where: { name: "superadmin" },
      update: {},
      create: { name: "superadmin", description: "Full access role" },
      select: { id: true, name: true },
    });

    await prisma.adminUserRole.upsert({
      where: { adminId_roleId: { adminId: admin.id, roleId: role.id } },
      update: {},
      create: { adminId: admin.id, roleId: role.id },
    });
  } catch {
    // schema ไม่มี role tables ก็ไม่เป็นไร (ล็อกอินได้อยู่)
  }

  console.log("[seedDev] OK:", { email: admin.email, adminId: admin.id });
}

main()
  .catch((e) => {
    console.error("[seedDev] ERROR", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

