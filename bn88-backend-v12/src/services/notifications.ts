import { prisma } from "../lib/prisma";

const IMPORTANT_KINDS = new Set([
  "deposit_missing",
  "withdraw_issue",
  "activity",
]);

type CaseNotificationSource = {
  id: string;
  tenant: string;
  botId?: string | null;
  kind?: string | null;
  userId?: string | null;
  text?: string | null;
  meta?: unknown;
};

function normalizeKind(kind?: string | null): string {
  return (kind ?? "").trim().toLowerCase();
}

function getString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isActivityReview(meta: unknown): boolean {
  const record = (meta as any) ?? {};
  const candidates = [
    record?.vision?.classification,
    record?.vision?.label,
    record?.intent,
    record?.reviewType,
  ];
  return candidates.some((item) => getString(item).toLowerCase().includes("review"));
}

function shouldNotifyCase(kind: string, meta: unknown): boolean {
  if (!IMPORTANT_KINDS.has(kind)) return false;
  if (kind !== "activity") return true;
  return isActivityReview(meta);
}

function buildNotificationTitle(kind: string): string {
  switch (kind) {
    case "deposit_missing":
      return "Deposit missing case";
    case "withdraw_issue":
      return "Withdraw issue case";
    case "activity":
      return "Activity review case";
    default:
      return `Case update: ${kind}`;
  }
}

function buildNotificationBody(payload: CaseNotificationSource): string | null {
  const parts = [] as string[];
  if (payload.userId) parts.push(`User ${payload.userId}`);
  const text = (payload.text ?? "").trim();
  if (text) parts.push(text.length > 160 ? `${text.slice(0, 157)}...` : text);
  return parts.length ? parts.join(" · ") : null;
}

export async function createNotificationForCase(
  payload: CaseNotificationSource
) {
  const kind = normalizeKind(payload.kind);
  if (!kind) return null;
  if (!shouldNotifyCase(kind, payload.meta)) return null;

  return prisma.notification.create({
    data: {
      tenant: payload.tenant,
      botId: payload.botId ?? null,
      caseId: payload.id,
      kind,
      title: buildNotificationTitle(kind),
      body: buildNotificationBody(payload),
    },
  });
}
