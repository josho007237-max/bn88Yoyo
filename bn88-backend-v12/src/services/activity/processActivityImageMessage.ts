// src/services/activity/processActivityImageMessage.ts
import { prisma } from "../../lib/prisma.js";
import {
  classifyImageWithOpenAI,
  ImageClass,
} from "../vision/classifyImage.js";
import type { ImageClass as ImageClassType } from "../vision/classifyImage.js";
import { redeemCode } from "./redeemCode.js";
import { resolveTodayRuleId } from "./resolveTodayRuleId.js";
import { toDataUrlFromMaybePath } from "../vision/toDataUrlFromMaybePath.js";
import { createNotificationForCase } from "../notifications.js";

type VisionResult = {
  classification: ImageClassType; // ACTIVITY | SLIP | OTHER | REVIEW
  confidence: number; // 0..1
  reason: string;
  raw?: any;
};

export type ActivityImagePipelineResult = {
  reply: string;
  intent: "activity" | "slip" | "other";
  isIssue: boolean;
  caseId: string | null;
  vision: VisionResult;
  pass: boolean;
  code: string | null;
};

type Params = {
  bot: any;
  platform: "line" | "telegram" | string;
  userId: string;
  sessionId: string;
  conversationId?: string | null;

  // ปกติระบบของพี่ส่งมาเป็น URL อยู่แล้ว (LINE content url / TG file url)
  attachmentUrl?: string | null;
  attachmentMeta?: Record<string, any> | null;

  captionText?: string | null;
  requestId?: string;

  // ถ้ามีจาก upstream ส่งมาได้เลย (ถ้าไม่มี ระบบจะ resolve จาก DailyRule วันนี้ให้)
  ruleId?: string;
  dateKey?: string;
};

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function normalizeVision(anyResult: any): VisionResult {
  const clsRaw = String(
    anyResult?.classification ??
      anyResult?.label ??
      anyResult?.type ??
      anyResult?.result ??
      "REVIEW"
  ).toUpperCase();

  const confidence = clamp01(
    Number(anyResult?.confidence ?? anyResult?.score ?? 0)
  );
  const reason = typeof anyResult?.reason === "string" ? anyResult.reason : "";

  const classification: ImageClassType =
    clsRaw === "ACTIVITY"
      ? (ImageClass.ACTIVITY as ImageClassType)
      : clsRaw === "SLIP"
        ? (ImageClass.SLIP as ImageClassType)
        : clsRaw === "OTHER"
          ? (ImageClass.OTHER as ImageClassType)
          : (ImageClass.REVIEW as ImageClassType);

  return { classification, confidence, reason, raw: anyResult };
}

function decidePass(v: VisionResult) {
  return (
    v.classification === (ImageClass.ACTIVITY as ImageClassType) &&
    v.confidence >= 0.6
  );
}

async function fetchImageRef(p: Params): Promise<string> {
  const url = p.attachmentUrl || "";
  if (!url) throw new Error("NO_ATTACHMENT_URL");
  return url;
}

async function classifySafe(
  imageRef: string,
  text?: string | null
): Promise<VisionResult> {
  // รองรับ 2 signature:
  // 1) classifyImageWithOpenAI({ imageDataUrl, text })
  // 2) classifyImageWithOpenAI(imageDataUrl, text)
  try {
    const r = await (classifyImageWithOpenAI as any)({
      imageDataUrl: imageRef,
      text: text ?? "",
    });
    return normalizeVision(r);
  } catch {
    const r2 = await (classifyImageWithOpenAI as any)(imageRef, text ?? "");
    return normalizeVision(r2);
  }
}

export async function processActivityImageMessage(
  p: Params
): Promise<ActivityImagePipelineResult> {
  const tenant = String(p.bot?.tenant || "bn9");
  const botId = String(p.bot?.id);

  const imageRefRaw = await fetchImageRef(p);
  const imageRef = await toDataUrlFromMaybePath(imageRefRaw);
  let vision = await classifySafe(imageRef, p.captionText);

  const userWantsActivity = (p.captionText || "").includes("กิจกรรม");
  if (
    userWantsActivity &&
    vision.classification === (ImageClass.SLIP as ImageClassType)
  ) {
    vision = {
      ...vision,
      classification: ImageClass.REVIEW as any,
      confidence: Math.min(vision.confidence, 0.6),
    };
  }
  const pass = decidePass(vision);

  // ตั้ง kind/intent
  let kind: "activity" | "slip" = "activity";
  let intent: "activity" | "slip" | "other" = "other";

  if (vision.classification === (ImageClass.SLIP as ImageClassType)) {
    kind = "slip";
    intent = "slip";
  } else if (
    vision.classification === (ImageClass.ACTIVITY as ImageClassType) ||
    vision.classification === (ImageClass.REVIEW as ImageClassType)
  ) {
    kind = "activity";
    intent = "activity";
  } else {
    intent = "other";
  }

  // สร้างเคสเฉพาะ ACTIVITY/REVIEW/SLIP (OTHER ไม่ต้องสร้าง)
  const shouldCreateCase =
    vision.classification === (ImageClass.ACTIVITY as ImageClassType) ||
    vision.classification === (ImageClass.REVIEW as ImageClassType) ||
    vision.classification === (ImageClass.SLIP as ImageClassType);

  let caseId: string | null = null;

  if (shouldCreateCase) {
    const c = await prisma.caseItem.create({
      data: {
        tenant,
        botId,
        platform: p.platform,
        sessionId: p.sessionId,
        userId: p.userId,
        kind,
        text: p.captionText?.trim() || `[image:${kind}]`,
        meta: {
          vision,
          pass,
          attachmentUrl: p.attachmentUrl || null,
          attachmentMeta: p.attachmentMeta || null,
          createdFrom: "activity_image_pipeline",
          requestId: p.requestId || null,
          upstreamRuleId: p.ruleId || null,
          upstreamDateKey: p.dateKey || null,
        } as any,
      },
      select: { id: true },
    });
    caseId = c.id;

    await createNotificationForCase({
      id: c.id,
      tenant,
      botId,
      kind,
      userId: p.userId,
      text: p.captionText?.trim() || `[image:${kind}]`,
      meta: {
        vision,
        pass,
        attachmentUrl: p.attachmentUrl || null,
        attachmentMeta: p.attachmentMeta || null,
        createdFrom: "activity_image_pipeline",
        requestId: p.requestId || null,
        upstreamRuleId: p.ruleId || null,
        upstreamDateKey: p.dateKey || null,
      },
    });
  }

  // OTHER ตอบทันที
  if (vision.classification === (ImageClass.OTHER as ImageClassType)) {
    return {
      reply:
        "รูปนี้ยังไม่ใช่หลักฐานกิจกรรมค่ะ รบกวนส่งรูปกิจกรรม/ภารกิจที่ชัดเจนอีกครั้งนะคะ",
      intent: "other",
      isIssue: false,
      caseId: null,
      vision,
      pass: false,
      code: null,
    };
  }

  // SLIP ตอบทันที + อัปเดต meta ให้ชัด
  if (vision.classification === (ImageClass.SLIP as ImageClassType)) {
    if (caseId) {
      await prisma.caseItem.update({
        where: { id: caseId },
        data: { meta: { vision, pass: false, kind: "slip" } as any },
      });
    }
    return {
      reply:
        "รับรูปแล้วค่ะ (ดูเหมือนสลิป) ถ้าต้องการส่ง “หลักฐานกิจกรรม” รบกวนส่งรูปกิจกรรมมาอีกครั้งนะคะ",
      intent: "slip",
      isIssue: true,
      caseId,
      vision,
      pass: false,
      code: null,
    };
  }

  // REVIEW หรือ ACTIVITY แต่ยังไม่ผ่าน
  if (!pass) {
    if (caseId) {
      await prisma.caseItem.update({
        where: { id: caseId },
        data: { meta: { vision, pass: false, kind: "activity" } as any },
      });
    }
    return {
      reply:
        "รับรูปแล้วค่ะ กำลังตรวจสอบให้ (ถ้าระบบไม่ชัวร์ แอดมินจะเข้ามาดูให้อีกทีนะคะ)",
      intent: "activity",
      isIssue: true,
      caseId,
      vision,
      pass: false,
      code: null,
    };
  }

  // ===== PASS => redeem โค้ด =====
  let finalRuleId: string | null = p.ruleId ? String(p.ruleId) : null;
  let finalDateKey: string | undefined = p.dateKey
    ? String(p.dateKey)
    : undefined;

  // ถ้าไม่มี ruleId ให้ resolve วันนี้จาก DailyRule
  if (!finalRuleId) {
    try {
      const resolved = await resolveTodayRuleId({
        tenant,
        botId,
        dateKey: finalDateKey,
      });
      finalRuleId = resolved.ruleId;
      finalDateKey = finalDateKey ?? resolved.dateKey;
    } catch (e: any) {
      // หา rule ไม่เจอ => ตอบแบบให้แอดมินช่วย
      if (caseId) {
        await prisma.caseItem.update({
          where: { id: caseId },
          data: {
            meta: {
              vision,
              pass: true,
              redeem: {
                ok: false,
                msg: "DAILY_RULE_NOT_FOUND",
                err: String(e?.message || e),
              },
              code: null,
            } as any,
          },
        });
      }

      return {
        reply:
          "ผ่านกิจกรรมแล้วค่ะ แต่ระบบหา “กติกาวันนี้” ไม่เจอ เดี๋ยวแอดมินจะเข้ามาตรวจสอบให้นะคะ",
        intent: "activity",
        isIssue: true,
        caseId,
        vision,
        pass: true,
        code: null,
      };
    }
  }

  // ตอนนี้ต้องมี ruleId แน่นอน
  const redemption = await redeemCode({
    tenant,
    botId,
    userId: p.userId,
    ruleId: finalRuleId,
    dateKey: finalDateKey,
  });

  const redeemedCode: string | null = redemption.ok
    ? redemption.code
    : (redemption.code ?? null);

  if (caseId) {
    await prisma.caseItem.update({
      where: { id: caseId },
      data: {
        meta: {
          vision,
          pass: true,
          ruleId: finalRuleId,
          dateKey: finalDateKey ?? null,
          redeem: redemption,
          code: redeemedCode,
        } as any,
      },
    });
  }

  if (!redemption.ok) {
    if (redemption.msg === "ALREADY_REDEEMED_TODAY" && redeemedCode) {
      return {
        reply: `วันนี้คุณรับโค้ดไปแล้วค่ะ โค้ดเดิมคือ: ${redeemedCode}`,
        intent: "activity",
        isIssue: true,
        caseId,
        vision,
        pass: true,
        code: redeemedCode,
      };
    }

    if (redemption.msg === "OUT_OF_STOCK") {
      return {
        reply:
          "ผ่านกิจกรรมแล้วค่ะ แต่โค้ดในระบบหมดพอดี แอดมินจะเติมโค้ดและส่งให้ในแชทนี้นะคะ",
        intent: "activity",
        isIssue: true,
        caseId,
        vision,
        pass: true,
        code: null,
      };
    }

    return {
      reply:
        "ผ่านกิจกรรมแล้วค่ะ แต่ระบบแจกโค้ดไม่สำเร็จ แอดมินจะเข้ามาช่วยตรวจสอบให้นะคะ",
      intent: "activity",
      isIssue: true,
      caseId,
      vision,
      pass: true,
      code: redeemedCode,
    };
  }

  return {
    reply: `ผ่านกิจกรรมแล้วค่ะ โค้ดของคุณคือ: ${redemption.code}`,
    intent: "activity",
    isIssue: true,
    caseId,
    vision,
    pass: true,
    code: redemption.code,
  };
}
