// src/scripts/setTelegramTokenForBot.ts
import { prisma } from "../lib/prisma";

async function main() {
  // 1) ใส่ Telegram Bot Token จาก BotFather ของคุณ
  const TELEGRAM_BOT_TOKEN =
    "8011188189:AAGlhbdbVHuxPh0Cf9VRUJE7hC_tBFpuapE"; // <-- แก้ให้ตรงกับของคุณ

  // 2) ใส่ botId ของบอทที่ใช้จริง (ดูจาก log ตอนนี้)
  const TARGET_BOT_ID = "cmic1cfmq000twicqst9oc6k"; // <-- ตอนนี้ของคุณคืออันนี้

  // 3) ตรวจว่ามีบอทนี้จริงไหม
  const bot = await prisma.bot.findUnique({
    where: { id: TARGET_BOT_ID },
  });

  if (!bot) {
    throw new Error(`ไม่พบบอท id=${TARGET_BOT_ID} ในตาราง Bot`);
  }

  console.log(
    "จะตั้งค่า telegramBotToken ให้ botId =",
    bot.id,
    "name =",
    bot.name,
    "platform =",
    bot.platform
  );

  // 4) upsert เข้า BotSecret
  await prisma.botSecret.upsert({
    where: { botId: bot.id },
    update: {
      telegramBotToken: TELEGRAM_BOT_TOKEN,
    },
    create: {
      botId: bot.id,
      telegramBotToken: TELEGRAM_BOT_TOKEN,
    },
  });

  console.log("✅ Updated telegramBotToken for botId =", bot.id);
}

main()
  .catch((e) => {
    console.error("[setTelegramTokenForBot] ERROR", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
