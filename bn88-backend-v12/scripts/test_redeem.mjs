import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const TENANT = "bn9";
const BOT_ID = "cmj205t6z0000vwest2b7bl0t";
const RULE_ID = "007237007237"; // <- ตัวที่ใช้งานจริง
const USER_ID = "U_TEST_001"; // เปลี่ยนเป็น user คนอื่นเพื่อเทสได้

function dateKeyBangkok() {
  // YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function main() {
  const dateKey = dateKeyBangkok();

  const result = await prisma.$transaction(async (tx) => {
    // 1) กันซ้ำ: คนเดิม/วันเดียวกัน/กติกาเดียวกัน
    const exist = await tx.codeRedemption.findFirst({
      where: {
        tenant: TENANT,
        botId: BOT_ID,
        userId: USER_ID,
        ruleId: RULE_ID,
        dateKey,
      },
      include: { codePool: true },
    });

    if (exist) {
      return {
        ok: false,
        msg: "ALREADY_REDEEMED_TODAY",
        code: exist.codePool?.code,
      };
    }

    // 2) หาโค้ด AVAILABLE
    const code = await tx.codePool.findFirst({
      where: {
        tenant: TENANT,
        botId: BOT_ID,
        ruleId: RULE_ID,
        status: "AVAILABLE",
      },
      orderBy: { createdAt: "asc" },
    });

    if (!code) return { ok: false, msg: "OUT_OF_STOCK" };

    // 3) ยิง updateMany กันชน (กันหยิบชนกัน)
    const updated = await tx.codePool.updateMany({
      where: { id: code.id, status: "AVAILABLE" },
      data: { status: "USED", usedAt: new Date(), usedBy: USER_ID },
    });

    if (updated.count !== 1) return { ok: false, msg: "RACE_CONDITION" };

    // 4) บันทึก redemption
    await tx.codeRedemption.create({
      data: {
        tenant: TENANT,
        botId: BOT_ID,
        userId: USER_ID,
        ruleId: RULE_ID,
        dateKey,
        codePoolId: code.id,
      },
    });

    return { ok: true, msg: "PASS", code: code.code };
  });

  console.log(result);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
