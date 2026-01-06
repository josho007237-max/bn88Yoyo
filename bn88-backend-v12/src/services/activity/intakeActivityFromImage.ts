// src/services/activity/intakeActivityFromImage.ts
import { prisma } from "../../lib/prisma";
import { classifyImageWithOpenAI } from "../vision/classifyImage";

type VisionLabel = "ACTIVITY" | "SLIP" | "OTHER" | "REVIEW";

type VisionResult = {
  label: VisionLabel;
  confidence: number;
  raw?: any;
};

export type IntakeParams = {
  tenant: string;
  botId: string;
  platform: string; // "line" | "telegram" ...
  channelKey?: string;

  userId: string;
  sessionId?: string | null;
  messageId?: string | null;

  // dataUrl base64 (ไม่ยัดลง DB)
  imageDataUrl: string;
  evidenceText?: string;
};

type IntakeResult =
  | { ok: true; caseId: string; vision: VisionResult; reply: string }
  | {
      ok: false;
      reason: "NOT_ACTIVITY" | "INVALID_INPUT";
      vision?: VisionResult;
      reply: string;
    };

function normalizeVision(anyResult: any): VisionResult {
  if (typeof anyResult === "string") {
    const label = String(anyResult).toUpperCase();
    if (label === "ACTIVITY" || label === "SLIP" || label === "OTHER") {
      return { label, confidence: 0.7, raw: anyResult };
    }
    return { label: "REVIEW", confidence: 0, raw: anyResult };
  }

  const label = String(
    anyResult?.label || anyResult?.type || anyResult?.result || "REVIEW"
  ).toUpperCase();

  const confidence = Number(anyResult?.confidence ?? anyResult?.score ?? 0);

  if (label === "ACTIVITY" || label === "SLIP" || label === "OTHER") {
    return {
      label,
      confidence: Number.isFinite(confidence) ? confidence : 0,
      raw: anyResult,
    };
  }

  return { label: "REVIEW", confidence: 0, raw: anyResult };
}

async function tryCampaignVision(imageDataUrl: string, text?: string) {
  // NOTE: node16/nodenext ต้องใส่ .js ใน relative import
  const mod: any = await import("../ai/campaignVision.js");

  const fn =
    mod.classifyCampaignImage ||
    mod.campaignVision ||
    mod.runCampaignVision ||
    mod.default;

  if (typeof fn !== "function") throw new Error("NO_VISION_EXPORT");

  return fn({ imageDataUrl, text });
}

async function tryVisionFallback(imageDataUrl: string, text?: string) {
  // รองรับ signature ได้ทั้ง 2 แบบ
  try {
    return await (classifyImageWithOpenAI as any)({ imageDataUrl, text });
  } catch {
    return await (classifyImageWithOpenAI as any)(imageDataUrl, text);
  }
}

async function classifyImageSafe(
  imageDataUrl: string,
  text?: string
): Promise<VisionResult> {
  // 1) campaignVision
  try {
    const r = await tryCampaignVision(imageDataUrl, text);
    const v = normalizeVision(r);
    return { ...v, raw: { source: "campaignVision", data: v.raw ?? r } };
  } catch (e: any) {
    // 2) fallback -> classifyImageWithOpenAI
    try {
      const r2 = await tryVisionFallback(imageDataUrl, text);
      const v2 = normalizeVision(r2);
      return {
        ...v2,
        raw: { source: "classifyImageWithOpenAI", data: v2.raw ?? r2 },
      };
    } catch (e2: any) {
      // 3) กันพัง
      return {
        label: "REVIEW",
        confidence: 0,
        raw: {
          error: e2?.message || String(e2),
          prevError: e?.message || String(e),
        },
      };
    }
  }
}

export async function intakeActivityFromImage(
  p: IntakeParams
): Promise<IntakeResult> {
  if (
    !p?.tenant ||
    !p?.botId ||
    !p?.platform ||
    !p?.userId ||
    !p?.imageDataUrl
  ) {
    return {
      ok: false,
      reason: "INVALID_INPUT",
      reply: "ข้อมูลไม่ครบค่ะ รบกวนส่งใหม่อีกครั้งนะคะ",
    };
  }

  const vision = await classifyImageSafe(p.imageDataUrl, p.evidenceText);

  const shouldCreate = vision.label === "ACTIVITY" || vision.label === "REVIEW";

  if (!shouldCreate) {
    return {
      ok: false,
      reason: "NOT_ACTIVITY",
      vision,
      reply:
        vision.label === "SLIP"
          ? "รูปนี้ดูเหมือนสลิปค่ะ ถ้าส่งหลักฐานกิจกรรม รบกวนส่งรูปกิจกรรมอีกครั้งนะคะ"
          : "รูปนี้ยังไม่ใช่หลักฐานกิจกรรมค่ะ รบกวนส่งใหม่อีกครั้งนะคะ",
    };
  }

  const caseItem = await prisma.caseItem.create({
    data: {
      tenant: p.tenant,
      botId: p.botId,
      platform: p.platform,
      sessionId: p.sessionId ?? null,
      userId: p.userId,
      kind: "activity",
      text: p.evidenceText?.trim() || "[activity-image]",
      meta: {
        source: {
          messageId: p.messageId ?? null,
          channelKey: p.channelKey ?? null,
          hasImageDataUrl: true,
        },
        vision,
      } as any, // กัน Prisma JSON type เข้ม
    },
  });

  return {
    ok: true,
    caseId: caseItem.id,
    vision,
    reply:
      vision.label === "ACTIVITY"
        ? "รับหลักฐานกิจกรรมเรียบร้อยค่ะ กำลังตรวจสอบให้ รอสักครู่นะคะ"
        : "รับรูปแล้วค่ะ ระบบขอให้แอดมินช่วยตรวจสอบอีกครั้ง รอสักครู่นะคะ",
  };
}

