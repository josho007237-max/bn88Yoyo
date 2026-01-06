import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const TENANT = "bn9";
const BOT_ID = "cmj205t6z0000vwest2b7bl0t";
const OLD_RULE_ID = "007237007237"; // อันเก่า
const NEW_RULE_ID = "007237007237"; // อันใหม่ที่ถูกต้อง

async function main() {
  const r = await prisma.codePool.updateMany({
    where: {
      tenant: TENANT,
      botId: BOT_ID,
      ruleId: OLD_RULE_ID,
      status: "AVAILABLE",
    },
    data: { ruleId: NEW_RULE_ID },
  });
  console.log("updated:", r.count);
}

main().finally(async () => prisma.$disconnect());
