// src/scripts/seed.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const TENANT = process.env.TENANT_DEFAULT || "bn9";

  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "root@bn9.local";
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "bn9@12345";

  const BOT_ID = "dev-bot";
  const BOT_NAME = "Dev Bot";

  const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

  /* ------------------------------------------------------------------ */
  /* 1) Admin user                                                      */
  /* ------------------------------------------------------------------ */
  const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const admin = await prisma.adminUser.upsert({
    where: { email: ADMIN_EMAIL },
    update: { password: hash },
    create: { email: ADMIN_EMAIL, password: hash },
  });

  console.log("Seeded admin:", {
    email: admin.email,
    password: ADMIN_PASSWORD,
  });

  /* ------------------------------------------------------------------ */
  /* 2) Dev Bot (uniq: tenant + name)                                   */
  /* ------------------------------------------------------------------ */
  const bot = await prisma.bot.upsert({
    where: {
      tenant_name: {
        tenant: TENANT,
        name: BOT_NAME,
      },
    },
    update: {},
    create: {
      id: BOT_ID,
      tenant: TENANT,
      name: BOT_NAME,
      platform: "line",
      active: true,
    },
  });

  console.log("Upserted bot:", {
    id: bot.id,
    tenant: bot.tenant,
    name: bot.name,
  });

  /* ------------------------------------------------------------------ */
  /* 3) AI Preset default ต่อ tenant (ไม่มี unique tenant_name ใน schema) */
  /* ------------------------------------------------------------------ */
  const existingPreset = await prisma.aiPreset.findFirst({
    where: {
      tenant: TENANT,
      name: "default",
    },
  });

  const preset =
    existingPreset
      ? await prisma.aiPreset.update({
          where: { id: existingPreset.id },
          data: {
            model: OPENAI_MODEL,
            temperature: 0.3,
            topP: 1,
            maxTokens: 800,
            systemPrompt: "",
          },
        })
      : await prisma.aiPreset.create({
          data: {
            tenant: TENANT,
            name: "default",
            model: OPENAI_MODEL,
            temperature: 0.3,
            topP: 1,
            maxTokens: 800,
            systemPrompt: "",
          },
        });

  console.log("Upserted preset:", {
    id: preset.id,
    tenant: preset.tenant,
    name: preset.name,
  });

  /* ------------------------------------------------------------------ */
  /* 4) BotConfig ผูกกับ bot + preset (uniq: botId)                     */
  /* ------------------------------------------------------------------ */
  await prisma.botConfig.upsert({
    where: { botId: bot.id },
    update: {
      tenant: bot.tenant,
      model: preset.model,
      temperature: preset.temperature ?? 0.3,
      topP: preset.topP ?? 1,
      maxTokens: preset.maxTokens ?? 800,
      systemPrompt: preset.systemPrompt ?? "",
      presetId: preset.id,
    },
    create: {
      botId: bot.id,
      tenant: bot.tenant,
      model: preset.model,
      temperature: preset.temperature ?? 0.3,
      topP: preset.topP ?? 1,
      maxTokens: preset.maxTokens ?? 800,
      systemPrompt: preset.systemPrompt ?? "",
      presetId: preset.id,
    },
  });

  console.log("Upserted botConfig for bot:", bot.id);

  /* ------------------------------------------------------------------ */
  /* 5) BotIntents สำหรับ dev-bot                                       */
  /* ------------------------------------------------------------------ */

  const intents = [
    {
      code: "deposit",
      title: "ฝากเงิน / ฝากไม่เข้า",
      keywords: ["ฝากเงิน", "ฝากไม่เข้า", "เติมเครดิต", "เครดิตไม่เข้า"],
      fallback:
        "ขอข้อมูลการฝากเพิ่มเติมหน่อยนะคะ เช่น ยอดที่โอน เวลา และธนาคารที่ใช้โอนค่ะ",
    },
    {
      code: "withdraw",
      title: "ถอนเงิน / ถอนไม่ออก",
      keywords: ["ถอนเงิน", "ถอนไม่ได้", "ถอนออก", "ถอนช้า"],
      fallback:
        "ขอข้อมูลการถอนเพิ่มเติม เช่น ยอดที่ต้องการถอน และธนาคารปลายทางค่ะ",
    },
    {
      code: "register",
      title: "สมัครสมาชิก / เปิดยูส",
      keywords: ["สมัคร", "เปิดยูส", "สมัครสมาชิก"],
      fallback:
        "ต้องการสมัครสมาชิกใช่ไหมคะ รบกวนแจ้งชื่อเล่น และเบอร์โทรสำหรับติดต่อกลับด้วยค่ะ",
    },
    {
      code: "other",
      title: "ถามทั่วไป / อื่น ๆ",
      keywords: [],
      fallback:
        "รับทราบค่ะ รบกวนอธิบายเพิ่มเติมนิดนึงได้ไหมคะ ว่าต้องการให้ช่วยเรื่องอะไร 😊",
    },
  ];

  // ล้าง intent เดิมของ dev-bot ก่อน (กันซ้ำเวลารัน seed ซ้ำ)
  await prisma.botIntent.deleteMany({
    where: {
      tenant: TENANT,
      botId: bot.id,
    },
  });

  await prisma.botIntent.createMany({
    data: intents.map((i) => ({
      tenant: TENANT,
      botId: bot.id,
      code: i.code,
      title: i.title,
      keywords: i.keywords, // Prisma Json รองรับ string[] ได้
      fallback: i.fallback,
    })),
    // ใช้ SQLite ตอนนี้ skipDuplicates ใช้ไม่ได้ เลยไม่ใส่
  });

  console.log("[seed] botIntents for dev-bot created");

  console.log("✅ Seed script completed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

