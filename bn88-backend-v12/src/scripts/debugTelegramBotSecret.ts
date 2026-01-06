// src/scripts/debugTelegramBotSecret.ts
import { prisma } from "../lib/prisma";

async function main() {
  const bots = await prisma.bot.findMany({
    where: { tenant: "bn9", platform: "telegram" },
    include: { secret: true },
  });

  console.log("Found telegram bots =", bots.length);

  for (const b of bots) {
    console.log("---------------");
    console.log("botId   =", b.id);
    console.log("name    =", b.name);
    console.log("secret? =", !!b.secret);
    if (b.secret) {
      console.log("telegramBotToken =", b.secret.telegramBotToken);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

