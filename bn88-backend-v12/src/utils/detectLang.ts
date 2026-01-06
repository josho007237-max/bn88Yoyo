// src/utils/detectLang.ts
export type ReplyLang = "th" | "lo" | "en";

const THAI_RE = /[\u0E00-\u0E7F]/g; // Thai block
const LAO_RE = /[\u0E80-\u0EFF]/g; // Lao block
const LATIN_RE = /[A-Za-z]/g;

function countMatches(text: string, re: RegExp): number {
  const m = text.match(re);
  return m ? m.length : 0;
}

/**
 * Detect reply language from the latest user message (fast heuristic).
 * - th: มีอักษรไทยเด่น
 * - lo: มีอักษรลาวเด่น
 * - en: ไม่เจอไทย/ลาว แต่มีอังกฤษ
 */
export function detectReplyLang(text: string): ReplyLang {
  const t = (text || "").trim();
  if (!t) return "th";

  const th = countMatches(t, THAI_RE);
  const lo = countMatches(t, LAO_RE);
  const en = countMatches(t, LATIN_RE);

  // ถ้ามีลาว/ไทยชัดเจน ให้ชนะก่อน
  if (lo > 0 && lo >= th) return "lo";
  if (th > 0) return "th";

  // ไม่เจอไทย/ลาว แต่มีอังกฤษ
  if (en > 0) return "en";

  // default
  return "th";
}

export function langLabel(lang: ReplyLang): string {
  if (lang === "lo") return "Lao";
  if (lang === "en") return "English";
  return "Thai";
}

export function fallbackNeedMoreInfo(lang: ReplyLang): string {
  if (lang === "lo") {
    return "ຂໍອະໄພເດີ້ ຍັງບໍ່ເຂົ້າໃຈສິ່ງທີ່ສົ່ງມາ ຊ່ວຍພິມອະທິບາຍເພີ່ມເຕີມໄດ້ບໍ?";
  }
  if (lang === "en") {
    return "Sorry—I can’t fully understand what you sent. Could you describe the issue in text with a bit more detail?";
  }
  return "พี่พลอยยังไม่ค่อยเข้าใจสิ่งที่ลูกค้าส่งมาเลยค่ะ รบกวนพิมพ์อธิบายปัญหาหรือเรื่องที่อยากให้ช่วยเพิ่มเติมเป็นข้อความให้พี่พลอยหน่อยได้ไหมคะ";
}

export function fallbackSystemError(lang: ReplyLang): string {
  if (lang === "lo") {
    return "ຂໍອະໄພເດີ້ ລະບົບມີບັນຫາຊົ່ວຄາວ ກະລຸນາລອງໃໝ່ອີກຄັ້ງພາຍຫຼັງ";
  }
  if (lang === "en") {
    return "Sorry—our system is temporarily unavailable. Please try again in a moment.";
  }
  return "ขออภัยค่ะ ระบบขัดข้องชั่วคราว พี่พลอยตอบให้ตอนนี้ไม่ได้จริง ๆ รบกวนลองใหม่อีกครั้งภายหลังนะคะ";
}

