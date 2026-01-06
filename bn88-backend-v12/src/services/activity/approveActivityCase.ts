import { PrismaClient } from "@prisma/client";
import { redeemCode } from "./redeemCode";
import { pushLineText } from "../line/pushLineText";

const prisma = new PrismaClient();

function render(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

export async function approveActivityCase(params: { caseId: string }) {
  const c = await prisma.caseItem.findUnique({ where: { id: params.caseId } });
  if (!c) throw new Error("CASE_NOT_FOUND");
  if (c.kind !== "activity") throw new Error("NOT_ACTIVITY_CASE");

  const meta: any = c.meta ?? {};
  const ruleId: string | undefined = meta.ruleId;
  if (!ruleId) throw new Error("CASE_META_RULEID_MISSING");

  const rule = await prisma.dailyRule
    .findUnique({ where: { id: ruleId } })
    .catch(() => null);
  if (!rule) throw new Error("DAILY_RULE_NOT_FOUND");

  const botSecret = await prisma.botSecret.findUnique({
    where: { botId: c.botId },
  });
  const token = botSecret?.channelAccessToken;
  if (!token) throw new Error("LINE_CHANNEL_ACCESS_TOKEN_MISSING");

  const redeemed = await redeemCode({
    tenant: c.tenant,
    botId: c.botId,
    userId: c.userId,
    ruleId,
    dateKey: meta.dateKey, // ถ้ามี
  });

  let textToUser = "";
  if (redeemed.ok) {
    textToUser = render(rule.passReply ?? "ยินดีด้วย ได้โค้ด {code}", {
      code: redeemed.code,
    });
  } else {
    // กันซ้ำ/หมดโค้ด
    if (redeemed.msg === "ALREADY_REDEEMED_TODAY") {
      textToUser = "วันนี้คุณรับโค้ดกิจกรรมไปแล้วครับ";
    } else if (redeemed.msg === "OUT_OF_STOCK") {
      textToUser = "ขอโทษครับ โค้ดรอบนี้หมดแล้ว";
    } else {
      textToUser = "ขอโทษครับ ระบบทำรายการไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
    }
  }

  // ส่งข้อความไปลูกค้า (LINE push)
  await pushLineText({
    channelAccessToken: token,
    to: c.userId,
    text: textToUser,
  });

  // อัปเดตเคสเก็บผล
  await prisma.caseItem.update({
    where: { id: c.id },
    data: {
      meta: {
        ...(meta ?? {}),
        decision: redeemed.ok ? "APPROVED" : "APPROVE_FAILED",
        redeemMsg: redeemed.msg,
        code: redeemed.ok ? redeemed.code : redeemed.code,
        approvedAt: new Date().toISOString(),
      },
    },
  });

  return { ok: true, redeemed };
}

