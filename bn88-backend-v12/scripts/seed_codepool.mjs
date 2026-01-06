import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const TENANT = "bn9";
const BOT_ID = "cmj205t6z0000vwest2b7bl0t";
const RULE_ID = "007237007237";
const COUNT = 100;

function genCode(i) {
  // สร้าง 11 หลักแบบไม่ซ้ำในรอบนี้
  const base = BigInt(Date.now()) * 1000n + BigInt(i);
  const n = base.toString().slice(-11).padStart(11, "0");
  return `C0D;${n}`;
}

async function main() {
  const data = Array.from({ length: COUNT }, (_, i) => ({
    tenant: TENANT,
    botId: BOT_ID,
    ruleId: RULE_ID,
    code: genCode(i),
    status: "AVAILABLE",
  }));

  const r = await prisma.codePool.createMany({ data }); // ❌ ไม่ใช้ skipDuplicates
  console.log("created:", r.count);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
