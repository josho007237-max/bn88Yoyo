import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
import { PrismaClient } from "@prisma/client";

let findFaqAnswer: typeof import("../src/services/faq")["findFaqAnswer"];

const testDbPath = path.join(__dirname, "integration", "tmp", "faq.db");
const testDbUrl = `file:${testDbPath}`;

process.env.DATABASE_URL = testDbUrl;
process.env.NODE_ENV = "test";
process.env.SECRET_ENC_KEY_BN9 =
  process.env.SECRET_ENC_KEY_BN9 || "12345678901234567890123456789012";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt";
process.env.TENANT_DEFAULT = process.env.TENANT_DEFAULT || "tenant-1";

const prisma = new PrismaClient({ datasources: { db: { url: testDbUrl } } });

async function resetDb() {
  fs.mkdirSync(path.dirname(testDbPath), { recursive: true });
  execSync(
    "npx prisma db push --force-reset --skip-generate --schema prisma/schema.prisma",
    {
      env: { ...process.env, DATABASE_URL: testDbUrl },
      stdio: "inherit",
    }
  );
}

async function seedBot() {
  await prisma.bot.create({
    data: {
      id: "bot-faq",
      tenant: "tenant-1",
      name: "FAQ Bot",
      platform: "line",
      active: true,
    },
  });
}

async function clearDb() {
  await prisma.fAQ.deleteMany();
  await prisma.bot.deleteMany();
}

describe("faq matching", () => {
  beforeAll(async () => {
    await resetDb();
    ({ findFaqAnswer } = await import("../src/services/faq"));
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await clearDb();
    await seedBot();
  });

  it("matches when text contains the FAQ question", async () => {
    const faq = await prisma.fAQ.create({
      data: {
        botId: "bot-faq",
        question: "ถอนเงินไม่ได้",
        answer: "ตรวจสอบยอดเงินคงเหลือและเชื่อมบัญชีให้ถูกต้อง",
      },
    });

    const result = await findFaqAnswer!(
      "bot-faq",
      "ลูกค้าบอกว่าถอนเงินไม่ได้ค่ะ",
      "req-1"
    );

    expect(result?.faqId).toBe(faq.id);
    expect(result?.answer).toContain("ยอดเงินคงเหลือ");
  });

  it("returns null when no FAQ matches", async () => {
    await prisma.fAQ.create({
      data: {
        botId: "bot-faq",
        question: "สมัครสมาชิก",
        answer: "กดปุ่มสมัครสมาชิกที่เมนูหลัก",
      },
    });

    const result = await findFaqAnswer!(
      "bot-faq",
      "สอบถามโปรโมชั่นล่าสุด",
      "req-2"
    );

    expect(result).toBeNull();
  });
});
