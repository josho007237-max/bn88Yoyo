import { prisma } from "../lib/prisma";
import { createRequestLogger } from "../utils/logger";

export async function findFaqAnswer(
  botId: string,
  text: string,
  requestId?: string
): Promise<{ answer: string; faqId: string } | null> {
  const log = createRequestLogger(requestId);
  const trimmed = text.toLowerCase();
  const faqs = await prisma.fAQ.findMany({
    where: { botId },
    orderBy: { createdAt: "asc" },
  });

  for (const faq of faqs) {
    const question = (faq.question || "").toLowerCase();
    const keywords = Array.isArray((faq as any).keywords)
      ? ((faq as any).keywords as string[])
      : typeof (faq as any).keywords === "string"
        ? String((faq as any).keywords)
            .split(",")
            .map((k) => k.trim().toLowerCase())
            .filter(Boolean)
        : [];

    if (question && trimmed.includes(question)) {
      log.info("[faq] matched", { faqId: faq.id });
      return { answer: faq.answer, faqId: faq.id };
    }

    if (keywords.length > 0 && keywords.some((k) => trimmed.includes(k))) {
      log.info("[faq] matched_keyword", { faqId: faq.id });
      return { answer: faq.answer, faqId: faq.id };
    }
  }

  if (trimmed.includes("?") && faqs[0]) {
    log.info("[faq] fallback first faq", { faqId: faqs[0].id });
    return { answer: faqs[0].answer, faqId: faqs[0].id };
  }

  return null;
}

