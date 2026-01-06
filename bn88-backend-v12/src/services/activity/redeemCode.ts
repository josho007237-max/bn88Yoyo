// src/services/activity/redeemCode.ts
import { prisma } from "../../lib/prisma.js";

function dateKeyBangkok(d: Date = new Date()): string {
  // YYYY-MM-DD (Asia/Bangkok)
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export type RedeemCodeParams = {
  tenant: string;
  botId: string;
  userId: string;
  ruleId: string;
  dateKey?: string;
};

export type RedeemCodeResult =
  | {
      ok: true;
      msg: "PASS";
      code: string;
      codePoolId: string;
      dateKey: string;
    }
  | {
      ok: false;
      msg: "ALREADY_REDEEMED_TODAY";
      code: string | null;
    }
  | {
      ok: false;
      msg: "OUT_OF_STOCK";
      code: null;
    }
  | {
      ok: false;
      msg: "RACE_CONDITION";
      code: null;
    }
  | {
      ok: false;
      msg: "ERROR";
      code: null;
      error: string;
    };

export async function redeemCode(
  params: RedeemCodeParams
): Promise<RedeemCodeResult> {
  const { tenant, botId, userId, ruleId } = params;
  const dateKey = params.dateKey ?? dateKeyBangkok();

  try {
    return await prisma.$transaction(async (tx) => {
      // 1) กันซ้ำต่อวัน (user + rule)
      const exist = await tx.codeRedemption.findFirst({
        where: { tenant, botId, userId, ruleId, dateKey },
        include: { codePool: true },
      });

      if (exist) {
        return {
          ok: false as const,
          msg: "ALREADY_REDEEMED_TODAY" as const,
          code: exist.codePool?.code ?? null,
        };
      }

      // 2) จองโค้ดแบบกันชน (retry กัน race)
      for (let attempt = 0; attempt < 3; attempt++) {
        const codeRow = await tx.codePool.findFirst({
          where: { tenant, botId, ruleId, status: "AVAILABLE" },
          orderBy: { createdAt: "asc" },
        });

        if (!codeRow) {
          return {
            ok: false as const,
            msg: "OUT_OF_STOCK" as const,
            code: null,
          };
        }

        // updateMany + where status ช่วยกันแย่งโค้ด
        const updated = await tx.codePool.updateMany({
          where: { id: codeRow.id, status: "AVAILABLE" },
          data: { status: "USED", usedAt: new Date(), usedBy: userId },
        });

        if (updated.count === 1) {
          await tx.codeRedemption.create({
            data: {
              tenant,
              botId,
              userId,
              ruleId,
              dateKey,
              codePoolId: codeRow.id,
            },
          });

          return {
            ok: true as const,
            msg: "PASS" as const,
            code: codeRow.code,
            codePoolId: codeRow.id,
            dateKey,
          };
        }
      }

      return { ok: false as const, msg: "RACE_CONDITION" as const, code: null };
    });
  } catch (e: any) {
    return {
      ok: false as const,
      msg: "ERROR" as const,
      code: null,
      error: e?.message ? String(e.message) : String(e),
    };
  }
}
