// src/lib/api.ts
import axios, {
  AxiosError,
  AxiosResponse,
  type InternalAxiosRequestConfig,
  type AxiosRequestHeaders,
} from "axios";

/* ============================ Local Types ============================ */

export type Health = { ok: boolean; time?: string; adminApi?: boolean };

export type BotPlatform = "line" | "telegram" | "facebook";

export type BotItem = {
  id: string;
  name: string;
  platform: BotPlatform;
  active: boolean;
  tenant?: string | null;
  verifiedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type BotListResponse = { ok: boolean; items: BotItem[] };
export type BotGetResponse = { ok: boolean; bot: BotItem };

export type BotSecretsPayload = {
  openaiApiKey?: string | null;
  openAiApiKey?: string | null; // casing alias
  lineAccessToken?: string | null;
  lineChannelSecret?: string | null;

  // alias เดิม (เผื่อ UI เก่า)
  openaiKey?: string | null;
  lineSecret?: string | null;
};

export type BotSecretsMasked = {
  ok?: boolean;
  openaiApiKey?: string; // "********" ถ้ามีค่า
  lineAccessToken?: string; // "********" ถ้ามีค่า
  lineChannelSecret?: string; // "********" ถ้ามีค่า
};

export type BotSecretsSaveResponse = {
  ok: boolean;
  botId: string;
  saved: {
    openaiApiKey: boolean;
    lineAccessToken: boolean;
    lineChannelSecret: boolean;
  };
};

export type CaseStatus =
  | "PENDING"
  | "REVIEW"
  | "RESOLVED"
  | "APPROVED"
  | "REJECTED"
  | "NEED_MORE_INFO";

export type CaseAttachment = {
  url: string;
  type?: "image" | "file";
  source?: string;
  lineContentId?: string | null;
};

export type CaseItem = {
  id: string;
  botId: string;
  userId?: string | null;
  text?: string | null;
  kind?: string | null;
  createdAt?: string;
  platform?: string | null;
  status?: CaseStatus;
  reviewNotes?: string | null;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  assigneeId?: string | null;
  meta?: unknown;
  attachments?: CaseAttachment[];
  bot?: { id: string; name?: string | null };
  session?: {
    id: string;
    displayName?: string | null;
    userId?: string | null;
    platform?: string | null;
  };
  assignee?: { id: string; email?: string | null };
};
export type RecentCasesResponse = { ok: boolean; items: CaseItem[] };
export type AdminCaseListResponse = {
  ok: boolean;
  items: CaseItem[];
  total: number;
  page: number;
  pageSize: number;
};
export type AdminCaseDetailResponse = { ok: boolean; item: CaseItem };

export type DailyStat = {
  botId: string;
  dateKey: string;
  total: number;
  text: number;
  follow: number;
  unfollow: number;
};
export type DailyResp = { ok: boolean; dateKey: string; stats: DailyStat };

export type RangeItem = {
  dateKey: string;
  total: number;
  text: number;
  follow: number;
  unfollow: number;
};

export type RangeResp = {
  ok: boolean;
  items: RangeItem[];
  summary: { total: number; text: number; follow: number; unfollow: number };
};

export type ChatMetricsItem = {
  dateKey: string;
  messageIn: number;
  messageOut: number;
  botId?: string;
};

export type ChatMetricsResponse = {
  ok: boolean;
  range: { from: string; to: string };
  items: ChatMetricsItem[];
  summary: { messageIn: number; messageOut: number };
};

export type CaseMetricsItem = {
  dateKey: string;
  casesNew: number;
  casesResolved: number;
  botId?: string;
};

export type CaseMetricsResponse = {
  ok: boolean;
  range: { from: string; to: string };
  items: CaseMetricsItem[];
  summary: { casesNew: number; casesResolved: number };
};

/* ---- Bot Intents ---- */
export type BotIntent = {
  id: string;
  tenant: string;
  botId: string;
  code: string;
  title: string;
  keywords: string[] | null;
  fallback?: string | null;
  createdAt: string;
  updatedAt: string;
};

/* ---- Bot AI Config (per bot) ---- */
export type BotAiConfig = {
  botId: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  topP: number;
  maxTokens: number;
};

export type BotAiConfigResponse = {
  ok: boolean;
  config: BotAiConfig;
  allowedModels: string[];
};

/* ---- Chat Center types ---- */

export type ChatSession = {
  id: string;
  botId: string;
  platform: BotPlatform | string;
  userId: string;
  displayName?: string | null;

  lastMessageAt: string;
  createdAt?: string;
  updatedAt?: string;
  tenant?: string;

  lastText?: string | null;
  lastDirection?: "user" | "bot" | "admin" | string;
  status?: "open" | "pending" | "closed" | string;

  caseCount?: number;
  hasProblem?: boolean; // ชื่อจริงใน DB
  isIssue?: boolean; // map จาก hasProblem

  unread?: number;
  tags?: string | null; // ใน DB เป็น text
  adminNote?: string | null;
};

export type MessageType =
  | "TEXT"
  | "IMAGE"
  | "FILE"
  | "STICKER"
  | "SYSTEM"
  | "RICH"
  | "INLINE_KEYBOARD";

export type ChatMessage = {
  id: string;
  sessionId: string;
  conversationId?: string | null;

  tenant: string;
  botId: string;
  platform: string | null;

  senderType: "user" | "bot" | "admin";

  type?: MessageType | string;
  messageType?: string; // legacy field
  text: string | null;
  attachmentUrl?: string | null;
  attachmentMeta?: unknown;

  platformMessageId?: string | null;
  meta?: unknown;

  createdAt: string;
  updatedAt?: string;
  session?: {
    id: string;
    platform?: string | null;
    userId?: string | null;
    displayName?: string | null;
    botId?: string | null;
  };
};

const normalizeChatMessage = (m: ChatMessage): ChatMessage => ({
  ...m,
  conversationId:
    (m as any).conversationId ?? m.sessionId ?? m.session?.id ?? null,
});
const toArray = <T>(v: any): T[] => (Array.isArray(v) ? v : []);
export type ImageSampleItem = {
  id: string;
  tenant: string;
  botId: string;
  label: string;
  note?: string | null;
  ahash: string;
  mime?: string | null;
  size?: number | null;
  createdAt: string;
};

export async function listImageSamples(botId: string, label?: string) {
  const r = await API.get<{ ok: boolean; items: ImageSampleItem[] }>(
    "/admin/image-samples",
    { params: { botId, label: label || undefined } }
  );
  return r.data;
}

export async function uploadImageSamples(params: {
  botId: string;
  label: string;
  note?: string;
  files: File[];
}) {
  const fd = new FormData();
  fd.append("botId", params.botId);
  fd.append("label", params.label);
  if (params.note) fd.append("note", params.note);
  for (const f of params.files) fd.append("files", f);

  const r = await API.post("/admin/image-samples", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return r.data as any;
}

export async function deleteImageSample(id: string) {
  const r = await API.delete(`/admin/image-samples/${encodeURIComponent(id)}`);
  return r.data as any;
}

export async function getImageSampleBlob(id: string): Promise<Blob> {
  const r = await API.get(
    `/admin/image-samples/${encodeURIComponent(id)}/blob`,
    {
      responseType: "blob",
    }
  );
  return r.data as Blob;
}

/* ========================== FAQ & Engagement types ========================== */

export type FaqEntry = {
  id: string;
  botId: string;
  question: string;
  answer: string;
  keywords?: string[] | null;
  enabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type EngagementMessage = {
  id: string;
  botId: string;
  platform: string;
  channelId: string;
  text: string;
  intervalMinutes: number;
  enabled: boolean;
  lastSentAt?: string | null;
  meta?: unknown;
  createdAt?: string;
  updatedAt?: string;
};

/* ============================== Knowledge FAQ =============================== */

export async function listFaqs(params?: {
  botId?: string;
  q?: string;
  page?: number;
  limit?: number;
}): Promise<{
  ok: boolean;
  items: FaqEntry[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}> {
  const res = await API.get(
    "/admin/ai/knowledge/faq",
    params?.botId || params?.q
      ? { params }
      : undefined
  );
  return res.data as any;
}

export async function createFaq(payload: {
  botId: string;
  question: string;
  answer: string;
}): Promise<FaqEntry> {
  const res = await API.post<{ ok: boolean; item: FaqEntry }>(
    "/admin/ai/knowledge/faq",
    payload
  );
  return (res.data as any).item ?? (res.data as any);
}

export async function updateFaq(
  id: string,
  payload: Partial<{ botId: string; question: string; answer: string }>
): Promise<FaqEntry> {
  const res = await API.patch<{ ok: boolean; item: FaqEntry }>(
    `/admin/ai/knowledge/faq/${encodeURIComponent(id)}`,
    payload
  );
  return (res.data as any).item ?? (res.data as any);
}

export async function deleteFaq(id: string): Promise<void> {
  await API.delete(`/admin/ai/knowledge/faq/${encodeURIComponent(id)}`);
}

/* ============================== Knowledge types ============================== */

export type KnowledgeDoc = {
  id: string;
  tenant: string;
  title: string;
  tags?: string | null;
  body: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  _count?: { chunks: number; bots: number };
};

export type KnowledgeDocDetail = KnowledgeDoc & {
  bots?: { botId: string; docId: string; bot?: BotItem }[];
};

export type KnowledgeChunk = {
  id: string;
  tenant: string;
  docId: string;
  content: string;
  embedding?: unknown;
  tokens: number;
  createdAt: string;
  updatedAt?: string;
};

export type KnowledgeListResponse = {
  ok: boolean;
  items: KnowledgeDoc[];
  page: number;
  limit: number;
  total: number;
  pages: number;
};

/* ---- LEP types ---- */

export type LepHealthResponse = {
  ok: boolean;
  source?: string;
  lepBaseUrl?: string;
  status?: number;
  data?: any;
};

export type LepCampaign = {
  id: string;
  name: string;
  message?: string;
  status?: string;
  totalTargets?: number | null;
  sentCount?: number;
  failedCount?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type LepCampaignList = {
  items?: LepCampaign[];
  page?: number;
  pageSize?: number;
  total?: number;
};

export type LepCampaignResponse = {
  ok: boolean;
  source?: string;
  lepBaseUrl?: string;
  status?: number;
  data: LepCampaign | { items?: LepCampaign[] } | LepCampaignList;
};

export type LepCampaignStatus = {
  status?: string;
  sentCount?: number;
  failedCount?: number;
  totalTargets?: number | null;
};

export type LepCampaignSchedule = {
  id: string;
  campaignId: string;
  cron: string;
  timezone: string;
  startAt?: string | null;
  endAt?: string | null;
  enabled?: boolean;
  repeatJobKey?: string | null;
  idempotencyKey?: string | null;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
};

/* ---- Live / Roles ---- */

export type LiveStream = {
  id: string;
  channelId: string;
  title: string;
  description?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  questions?: LiveQuestion[];
  polls?: LivePoll[];
};

export type LiveQuestion = {
  id: string;
  liveStreamId: string;
  userId?: string | null;
  question: string;
  answered: boolean;
  createdAt: string;
};

export type LivePoll = {
  id: string;
  liveStreamId: string;
  question: string;
  options: any;
  results?: any;
  closed: boolean;
  createdAt: string;
};

export type RoleItem = {
  id: string;
  name: string;
  description?: string | null;
  permissions?: string[];
};

export type AdminUserItem = {
  id: string;
  email: string;
  roles: RoleItem[];
};

/* ================================ Base / ENV ================================ */

function trimSlash(s: string) {
  return (s || "").replace(/\/+$/, "");
}

// IMPORTANT: baseURL ควรชี้ไปที่ "/api" (หรือ "http://localhost:3000/api")
export const API_BASE = trimSlash(
  (import.meta as any).env?.VITE_API_BASE ||
    (import.meta as any).env?.VITE_ADMIN_API_BASE ||
    "/api"
);

export const TENANT =
  (import.meta as any).env?.VITE_DEFAULT_TENANT ||
  (import.meta as any).env?.VITE_TENANT ||
  "bn9";

// ให้ทั้งโปรเจกต์ใช้ key เดียว (ให้สอดคล้องกับ RequireAuth ถ้าเดิมใช้ bn9_jwt)
export const TOKEN_KEY = "bn9_jwt";

// รองรับ key เก่าๆ ทั้งหมด (จะ migrate ให้เอง)
const LEGACY_TOKEN_KEYS = [
  "bn9.admin.token",
  "BN9_TOKEN",
  "bn9_token",
  "BN9_ADMIN_JWT",
];

/* ================================ Token Utils ================================ */

export function getToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export function setToken(t: string) {
  try {
    localStorage.setItem(TOKEN_KEY, t);
  } catch {
    // ignore
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    for (const k of LEGACY_TOKEN_KEYS) localStorage.removeItem(k);
  } catch {
    // ignore
  }
}

(function migrateLegacyToken() {
  try {
    const current = localStorage.getItem(TOKEN_KEY);
    if (current) return;

    for (const k of LEGACY_TOKEN_KEYS) {
      const v = localStorage.getItem(k);
      if (v) {
        localStorage.setItem(TOKEN_KEY, v);
        for (const kk of LEGACY_TOKEN_KEYS) localStorage.removeItem(kk);
        return;
      }
    }
  } catch {
    // ignore
  }
})();

/**
 * หุ้ม URL ให้พก token แอดมินไปด้วย (ใช้กับรูป / ไฟล์ ที่โหลดผ่าน <img>, <a>)
 */
export function withToken(url?: string | null): string {
  if (!url) return "";
  const token = getToken();
  if (!token) return url;

  const [base, hash] = url.split("#");
  const sep = base.includes("?") ? "&" : "?";
  const full = `${base}${sep}token=${encodeURIComponent(token)}`;
  return hash ? `${full}#${hash}` : full;
}

export function getApiBase() {
  return API_BASE || "/api";
}

/* ================================ Axios ================================ */

export const API = axios.create({
  baseURL: API_BASE || "/api",
  timeout: 15000,
});

// boot: ถ้ามี token อยู่แล้ว ให้ติด default header ไว้ก่อน
const bootToken = getToken();
if (bootToken) {
  API.defaults.headers.common.Authorization = `Bearer ${bootToken}`;
}

// Interceptors (ของเดิมคุณ) ...

// ✅ เพิ่มอันนี้ให้มี export จริง
/* ============================ Line Content (Image/File) ============================ */

export function getLineContentPath(id: string) {
  return `/admin/chat/line-content/${encodeURIComponent(id)}`;
}

export function getLineContentUrl(id: string) {
  const base = API_BASE || "/api";
  return withToken(`${base}${getLineContentPath(id)}`);
}

export async function getLineContentBlob(messageId: string): Promise<Blob> {
  const res = await API.get(getLineContentPath(messageId), {
    responseType: "blob",
  });
  return res.data as Blob;
}

export async function fetchLineContentObjectUrl(messageId: string): Promise<{
  url: string;
  revoke: () => void;
  contentType?: string;
  filename?: string;
}> {
  const res = await API.get(getLineContentPath(messageId), {
    responseType: "blob",
  });

  const blob = res.data as Blob;
  const url = URL.createObjectURL(blob);

  const contentType =
    (res.headers?.["content-type"] as string | undefined) ?? undefined;
  const cd = res.headers?.["content-disposition"] as string | undefined;
  const filename = cd?.match(/filename\*?=(?:UTF-8'')?("?)([^";]+)\1/i)?.[2];

  return { url, revoke: () => URL.revokeObjectURL(url), contentType, filename };
}

export function downloadObjectUrl(url: string, filename?: string) {
  const a = document.createElement("a");
  a.href = url;
  if (filename) a.download = filename;
  a.target = "_blank";
  a.rel = "noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

API.interceptors.request.use((cfg: InternalAxiosRequestConfig) => {
  const headers = (cfg.headers ?? {}) as AxiosRequestHeaders;

  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  headers["x-tenant"] = TENANT;

  cfg.headers = headers;
  return cfg;
});

API.interceptors.response.use(
  (r: AxiosResponse) => {
    const d: any = r.data;
    if (d && "items" in d) d.items = toArray(d.items);
    return r;
  },
  (err: AxiosError<any>) => {
    const status = err.response?.status;

    // ถ้าโดน 401: เคลียร์ token แล้วเด้งไป login (กัน loop ด้วย)
    if (status === 401) {
      clearToken();
      delete API.defaults.headers.common.Authorization;

      const p = globalThis.location?.pathname || "";
      if (p !== "/login") globalThis.location?.replace("/login");
    }

    return Promise.reject(err);
  }
);

/* ================================= Auth ================================ */

// IMPORTANT: admin login path ต้องเป็น /admin/auth/login (ไม่ใช่ /auth/login)
export async function login(email: string, password: string) {
  const r = await API.post<{ ok: boolean; token: string }>(
    "/admin/auth/login",
    {
      email,
      password,
    }
  );

  if (!r.data?.token) throw new Error("login failed: empty token");

  setToken(r.data.token);
  API.defaults.headers.common.Authorization = `Bearer ${r.data.token}`;

  return r.data;
}

export function logoutAndRedirect() {
  clearToken();
  delete API.defaults.headers.common.Authorization;
  globalThis.location?.assign("/login");
}

export async function fetchBlobObjectUrl(url: string): Promise<string> {
  const r = await API.get(url, { responseType: "blob" });
  return URL.createObjectURL(r.data);
}

export async function fetchBlob(url: string) {
  const r = await API.get(url, { responseType: "blob" });
  return URL.createObjectURL(r.data);
}

/* ============================== Bots APIs ============================== */

export async function getBots() {
  return (await API.get<BotListResponse>("/bots")).data;
}

export async function initBot(
  platform: BotPlatform = "line"
): Promise<BotItem> {
  const res = await API.post<{ ok: true; bot: BotItem }>("/bots/init", {
    platform,
  });
  return res.data.bot;
}

export async function getBot(botId: string) {
  return (await API.get<BotGetResponse>(`/bots/${encodeURIComponent(botId)}`))
    .data;
}

export async function updateBotMeta(
  botId: string,
  payload: Partial<{
    name: string | null;
    active: boolean;
    verifiedAt?: string | null;
  }>
) {
  return (
    await API.patch<{ ok: true; bot?: BotItem }>(
      `/admin/bots/${encodeURIComponent(botId)}`,
      payload
    )
  ).data;
}

/* ----- Secrets ----- */

export async function getBotSecrets(botId: string) {
  return (
    await API.get<BotSecretsMasked>(
      `/admin/bots/${encodeURIComponent(botId)}/secrets`
    )
  ).data;
}

export async function updateBotSecrets(
  botId: string,
  payload: BotSecretsPayload
) {
  const norm: BotSecretsPayload = {
    ...payload,
    openaiApiKey:
      payload.openaiApiKey ??
      payload.openAiApiKey ??
      payload.openaiKey ??
      undefined,
    lineChannelSecret:
      payload.lineChannelSecret ?? payload.lineSecret ?? undefined,
  };

  const body: Record<string, string> = {};

  if (norm.openaiApiKey && norm.openaiApiKey !== "********")
    body.openaiApiKey = String(norm.openaiApiKey).trim();

  if (norm.lineAccessToken && norm.lineAccessToken !== "********")
    body.lineAccessToken = String(norm.lineAccessToken).trim();

  if (norm.lineChannelSecret && norm.lineChannelSecret !== "********")
    body.lineChannelSecret = String(norm.lineChannelSecret).trim();

  return (
    await API.post<BotSecretsSaveResponse>(
      `/admin/bots/${encodeURIComponent(botId)}/secrets`,
      body
    )
  ).data;
}

/* ----- Roles & Admin users ----- */

export async function listRoles() {
  const res = await API.get<{ ok: boolean; items: RoleItem[] }>("/admin/roles");
  return res.data.items ?? [];
}

export async function listAdminUsersWithRoles() {
  const res = await API.get<{ ok: boolean; items: AdminUserItem[] }>(
    "/admin/roles/admin-users"
  );
  return res.data.items ?? [];
}

export async function assignRole(adminId: string, roleId: string) {
  return (
    await API.post<{ ok: boolean; adminId: string; roleId: string }>(
      "/admin/roles/assign",
      { adminId, roleId }
    )
  ).data;
}

export async function deleteBot(botId: string) {
  try {
    await API.delete(`/admin/bots/${encodeURIComponent(botId)}`);
    return { ok: true as const };
  } catch {
    return { ok: true as const, note: "DELETE not implemented on server" };
  }
}

/* ============================ Stats / Cases ============================ */

export async function getDailyByBot(botId: string) {
  return (await API.get<DailyResp>("/stats/daily", { params: { botId } })).data;
}

export async function getRangeByBot(botId: string, from: string, to: string) {
  return (
    await API.get<RangeResp>("/stats/range", { params: { botId, from, to } })
  ).data;
}

export async function getChatMetrics(params?: {
  from?: string;
  to?: string;
  botId?: string | null;
}) {
  return (
    await API.get<ChatMetricsResponse>("/admin/metrics/chat", { params })
  ).data;
}

export async function getCaseMetrics(params?: {
  from?: string;
  to?: string;
  botId?: string | null;
}) {
  return (
    await API.get<CaseMetricsResponse>("/admin/metrics/cases", { params })
  ).data;
}

export async function getRecentByBot(botId: string, limit = 20) {
  return (
    await API.get<RecentCasesResponse>("/cases/recent", {
      params: { botId, limit },
    })
  ).data;
}

export async function listAdminCases(params?: {
  status?: string;
  kind?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}) {
  const { data } = await API.get<AdminCaseListResponse>("/admin/cases", {
    params,
  });
  return data;
}

export async function getAdminCase(id: string) {
  const { data } = await API.get<AdminCaseDetailResponse>(
    `/admin/cases/${encodeURIComponent(id)}`
  );
  return data;
}

export async function updateAdminCase(
  id: string,
  payload: {
    status?: CaseStatus;
    reviewNotes?: string | null;
    resolvedAt?: string | Date | null;
    assigneeId?: string | null;
  }
) {
  const body: Record<string, unknown> = { ...payload };
  if (payload.resolvedAt instanceof Date)
    body.resolvedAt = payload.resolvedAt.toISOString();

  const { data } = await API.patch<AdminCaseDetailResponse>(
    `/admin/cases/${encodeURIComponent(id)}`,
    body,
  );
  return data;
}

export async function getDailyStats(tenant: string) {
  return (await API.get(`/stats/${encodeURIComponent(tenant)}/daily`)).data;
}

/* ============================== Dev tools ============================== */

export async function devLinePing(botId: string) {
  try {
    return (
      await API.get<{ ok: boolean; status: number }>(
        `/dev/line-ping/${encodeURIComponent(botId)}`
      )
    ).data;
  } catch {
    return (
      await API.get<{ ok: boolean; status: number }>(
        `/line-ping/${encodeURIComponent(botId)}`
      )
    ).data;
  }
}

/* ============================== Bot Intents APIs ============================== */

export async function getBotIntents(botId: string): Promise<BotIntent[]> {
  const res = await API.get<{ ok: boolean; items: BotIntent[] }>(
    `/admin/bots/${encodeURIComponent(botId)}/intents`
  );
  return res.data.items ?? [];
}

export async function createBotIntent(
  botId: string,
  payload: {
    code: string;
    title: string;
    keywords?: string | string[];
    fallback?: string;
  }
): Promise<BotIntent> {
  const res = await API.post<{ ok: boolean; item: BotIntent }>(
    `/admin/bots/${encodeURIComponent(botId)}/intents`,
    payload
  );
  return res.data.item;
}

export async function updateBotIntent(
  botId: string,
  id: string,
  payload: {
    code?: string;
    title?: string;
    keywords?: string | string[];
    fallback?: string | null;
  }
): Promise<BotIntent> {
  const res = await API.put<{ ok: boolean; item: BotIntent }>(
    `/admin/bots/${encodeURIComponent(botId)}/intents/${encodeURIComponent(id)}`,
    payload
  );
  return res.data.item;
}

export async function deleteBotIntent(
  botId: string,
  id: string
): Promise<void> {
  await API.delete(
    `/admin/bots/${encodeURIComponent(botId)}/intents/${encodeURIComponent(id)}`
  );
}

/* ============================== Bot AI Config APIs ============================== */

export async function getBotConfig(
  botId: string
): Promise<BotAiConfigResponse> {
  const res = await API.get<BotAiConfigResponse>(
    `/admin/bots/${encodeURIComponent(botId)}/config`
  );
  return res.data;
}

export async function updateBotConfig(
  botId: string,
  payload: Partial<BotAiConfig>
): Promise<BotAiConfigResponse> {
  const res = await API.put<BotAiConfigResponse>(
    `/admin/bots/${encodeURIComponent(botId)}/config`,
    payload
  );
  return res.data;
}
async function apiGet<T = any>(url: string): Promise<T> {
  // กันคนเผลอส่ง /api/... เข้ามา
  const path = url.startsWith("/api/") ? url.slice(4) : url;
  const res = await API.get<T>(path);
  return res.data;
}

/* ============================== Chat Center APIs ============================== */

export async function getChatSessions(
  botId: string,
  limit = 50,
  platform?: string,
  opts?: {
    status?: string;
    isIssue?: boolean;
    q?: string;
    dateFrom?: string;
    dateTo?: string;
  }
): Promise<ChatSession[]> {
  const res = await API.get<{ ok: boolean; items: ChatSession[] }>(
    "/admin/chat/sessions",
    {
      params: {
        botId,
        limit,
        platform,
        status: opts?.status,
        isIssue: opts?.isIssue != null ? String(opts.isIssue) : undefined,
        q: opts?.q,
        dateFrom: opts?.dateFrom,
        dateTo: opts?.dateTo,
      },
    }
  );

  const data: any = res.data;
  const rawItems = toArray<ChatSession>(data.items).length
    ? data.items
    : toArray<ChatSession>(data.sessions);

  return toArray<ChatSession>(rawItems).map((s: any) => ({
    ...s,
    hasProblem: s.hasProblem ?? s.isIssue ?? false,
    isIssue: s.hasProblem ?? s.isIssue ?? false,
  }));
} // <-- เพิ่มบรรทัดนี้ เพื่อปิด getChatSessions

export async function getChatMessages(
  sessionId: string,
  limit = 50,
  before?: string
): Promise<any> {
  if (!sessionId) throw new Error("missing_sessionId");
  const res = await API.get("/admin/chat/messages", {
    params: { sessionId, limit },
  });
  const items = toArray(res.data.items).length
    ? res.data.items
    : toArray(res.data.messages);
  return { ...res.data, items: toArray(items) };
}

export async function getChatMessagesByQuery(params: {
  conversationId?: string;
  sessionId?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: ChatMessage[]; conversationId: string | null }> {
  const res = await API.get<{
    ok: boolean;
    items: ChatMessage[];
    conversationId: string | null;
  }>("/admin/chat/messages", {
    params: {
      conversationId: params.conversationId,
      sessionId: params.sessionId,
      limit: params.limit ?? 200,
      offset: params.offset ?? 0,
    },
  });

  return {
    conversationId: res.data.conversationId,
    items: (res.data.items ?? []).map(normalizeChatMessage),
  };
}

export type ReplyChatSessionResponse = {
  ok: boolean;
  delivered?: boolean;
  messageId?: string;
  error?: string;
};
export type SendRichMessagePayload = {
  sessionId: string;
  platform?: string;
  title: string;
  body: string;
  imageUrl?: string;
  altText?: string;
  buttons?: Array<{ label: string; action: string; value: string }>;
  inlineKeyboard?: Array<Array<{ text: string; callbackData: string }>>;
};

export async function sendRichMessage(
  payload: SendRichMessagePayload
): Promise<{
  ok: boolean;
  delivered?: boolean;
  messageId?: string;
  error?: string;
}> {
  const sessionId = payload.sessionId?.trim();
  if (!sessionId) throw new Error("missing_sessionId");

  // ถ้า backend ของคุณใช้ path อื่น ให้แก้ “บรรทัดนี้บรรทัดเดียว”
  const res = await API.post(
    `/admin/chat/sessions/${encodeURIComponent(sessionId)}/rich`,
    payload
  );
  return res.data as any;
}

export async function replyChatSession(
  sessionId: string,
  payload: {
    text: string;
    type?: string;
    attachmentUrl?: string;
    attachmentMeta?: unknown;
  }
): Promise<ReplyChatSessionResponse> {
  const id = sessionId?.trim();
  if (!id) throw new Error("missing_sessionId");

  const res = await API.post<ReplyChatSessionResponse>(
    `/admin/chat/sessions/${encodeURIComponent(id)}/reply`,
    payload
  );
  return res.data;
}

export type ChatSessionUpdateResponse = {
  ok: boolean;
  session: ChatSession;
};

export async function updateChatSession(
  sessionId: string,
  payload: Partial<{
    displayName: string;
    adminNote: string | null;
    tags: string[];
  }>
): Promise<ChatSessionUpdateResponse> {
  const id = sessionId?.trim();
  if (!id) throw new Error("missing_sessionId");

  const res = await API.patch<ChatSessionUpdateResponse>(
    `/admin/chat/sessions/${encodeURIComponent(id)}`,
    payload
  );
  return res.data;
}

export async function updateChatSessionMeta(
  sessionId: string,
  payload: {
    status?: string;
    tags?: any; // จะ string หรือ array ให้ยืดหยุ่นไปก่อน
    hasProblem?: boolean;
    unread?: number;
  }
): Promise<{ ok: boolean }> {
  const res = await API.patch<{ ok: boolean }>(
    `/admin/chat/sessions/${encodeURIComponent(sessionId)}/meta`,
    payload
  );
  return res.data;
}

/* =========================== FAQ & Engagement =========================== */

export async function getFaqEntries(botId: string): Promise<FaqEntry[]> {
  const res = await listFaqs({ botId, limit: 200 });
  return res.items ?? [];
}

export async function createFaqEntry(payload: {
  botId: string;
  question: string;
  answer: string;
  keywords?: string[] | null;
  enabled?: boolean;
}): Promise<FaqEntry> {
  return createFaq({
    botId: payload.botId,
    question: payload.question,
    answer: payload.answer,
  });
}

export async function updateFaqEntry(
  id: string,
  payload: Partial<FaqEntry>
): Promise<FaqEntry> {
  return updateFaq(id, payload);
}

export async function deleteFaqEntry(id: string): Promise<void> {
  await deleteFaq(id);
}

export async function getEngagementMessages(
  botId: string
): Promise<EngagementMessage[]> {
  try {
    const res = await API.get<{ ok: boolean; items: EngagementMessage[] }>(
      "/admin/bot/engagement",
      { params: { botId } }
    );
    return (res.data as any).items ?? [];
  } catch (e: any) {
    if (e?.response?.status === 404) return [];
    throw e;
  }
}

export async function createEngagementMessage(payload: {
  botId: string;
  platform: string;
  channelId: string;
  text: string;
  intervalMinutes: number;
  enabled?: boolean;
  meta?: unknown;
}): Promise<EngagementMessage> {
  const res = await API.post<{ ok: boolean; item: EngagementMessage }>(
    "/admin/bot/engagement",
    {
      ...payload,
      // ถ้า backend ของคุณใช้ field ชื่อ interval ให้ส่งเพิ่มไปด้วย
      interval: payload.intervalMinutes,
    }
  );
  return (res.data as any).item ?? (res.data as any);
}

// เปลี่ยนเป็น /admin/bot/engagement/:id
export async function updateEngagementMessage(
  id: string,
  payload: Partial<EngagementMessage>
) {
  const res = await API.patch(
    `/admin/bot/engagement/${encodeURIComponent(id)}`,
    payload
  );
  return (res.data as any).item ?? (res.data as any);
}

export async function deleteEngagementMessage(id: string): Promise<void> {
  await API.delete(`/admin/bot/engagement/${encodeURIComponent(id)}`);
}

/* ============================== Knowledge APIs ============================== */

export async function listKnowledgeDocs(params?: {
  q?: string;
  status?: string;
  page?: number;
  limit?: number;
}): Promise<KnowledgeListResponse> {
  const res = await API.get<KnowledgeListResponse>("/admin/ai/knowledge/docs", {
    params,
  });
  return res.data;
}

export async function getKnowledgeDoc(id: string): Promise<{
  ok: boolean;
  item: KnowledgeDocDetail;
}> {
  const res = await API.get<{ ok: boolean; item: KnowledgeDocDetail }>(
    `/admin/ai/knowledge/docs/${encodeURIComponent(id)}`
  );
  return res.data;
}

export async function createKnowledgeDoc(payload: {
  title: string;
  tags?: string;
  body?: string;
  status?: string;
}): Promise<{ ok: boolean; item: KnowledgeDoc }> {
  const title = (payload.title ?? "").trim();
  const body = (payload.body ?? "").toString().trim();

  if (!title) throw new Error("title_required");
  if (!body) throw new Error("body_required"); // กัน 400 ตั้งแต่ FE

  const safe = {
    title,
    body,
    tags: payload.tags?.trim() || undefined,
    status: payload.status ?? "active",
  };

  const res = await API.post<{ ok: boolean; item: KnowledgeDoc }>(
    "/admin/ai/knowledge/docs",
    safe
  );
  return res.data;
}

export async function updateKnowledgeDoc(
  id: string,
  payload: Partial<{
    title: string;
    tags?: string;
    body?: string;
    status?: string;
  }>
): Promise<{ ok: boolean; item: KnowledgeDoc }> {
  const res = await API.patch<{ ok: boolean; item: KnowledgeDoc }>(
    `/admin/ai/knowledge/docs/${encodeURIComponent(id)}`,
    payload
  );
  return res.data;
}

export async function deleteKnowledgeDoc(id: string) {
  await API.delete(`/admin/ai/knowledge/docs/${encodeURIComponent(id)}`);
  return { ok: true as const };
}

export async function listKnowledgeChunks(
  docId: string
): Promise<{ ok: boolean; items: KnowledgeChunk[] }> {
  const res = await API.get<{ ok: boolean; items: KnowledgeChunk[] }>(
    `/admin/ai/knowledge/docs/${encodeURIComponent(docId)}/chunks`
  );
  return res.data;
}

export async function createKnowledgeChunk(
  docId: string,
  payload: { content: string; tokens?: number }
): Promise<{ ok: boolean; item: KnowledgeChunk }> {
  const res = await API.post<{ ok: boolean; item: KnowledgeChunk }>(
    `/admin/ai/knowledge/docs/${encodeURIComponent(docId)}/chunks`,
    payload
  );
  return res.data;
}

export async function updateKnowledgeChunk(
  chunkId: string,
  payload: Partial<{
    content: string;
    tokens?: number;
    embedding?: unknown;
  }>
): Promise<{ ok: boolean; item: KnowledgeChunk }> {
  const res = await API.patch<{ ok: boolean; item: KnowledgeChunk }>(
    `/admin/ai/knowledge/chunks/${encodeURIComponent(chunkId)}`,
    payload
  );
  return res.data;
}

export async function deleteKnowledgeChunk(chunkId: string) {
  await API.delete(`/admin/ai/knowledge/chunks/${encodeURIComponent(chunkId)}`);
  return { ok: true as const };
}

export async function getBotKnowledge(botId: string): Promise<{
  ok: boolean;
  botId: string;
  items: KnowledgeDoc[];
  docIds: string[];
}> {
  const res = await API.get<{
    ok: boolean;
    botId: string;
    items: KnowledgeDoc[];
    docIds: string[];
  }>(`/admin/ai/knowledge/bots/${encodeURIComponent(botId)}/knowledge`);
  return res.data;
}

export async function addBotKnowledge(botId: string, docId: string) {
  await API.post(
    `/admin/ai/knowledge/bots/${encodeURIComponent(botId)}/knowledge`,
    { docId }
  );
  return { ok: true as const };
}

export async function removeBotKnowledge(botId: string, docId: string) {
  await API.delete(
    `/admin/ai/knowledge/bots/${encodeURIComponent(botId)}/knowledge/${encodeURIComponent(
      docId
    )}`
  );
  return { ok: true as const };
}

/* ============================== LEP Admin Proxy ============================== */

export async function lepHealth() {
  return (await API.get<LepHealthResponse>("/admin/lep/health")).data;
}

export async function lepListCampaigns(params?: {
  page?: number;
  pageSize?: number;
}) {
  return (
    await API.get<LepCampaignResponse>("/admin/lep/campaigns", { params })
  ).data;
}

export async function lepCreateCampaign(payload: {
  name: string;
  message: string;
  targets?: any;
}) {
  return (await API.post<LepCampaignResponse>("/admin/lep/campaigns", payload))
    .data;
}

export async function lepQueueCampaign(id: string) {
  return (
    await API.post<LepCampaignResponse>(
      `/admin/lep/campaigns/${encodeURIComponent(id)}/queue`,
      {}
    )
  ).data;
}

export async function lepGetCampaign(id: string) {
  return (
    await API.get<LepCampaignResponse>(
      `/admin/lep/campaigns/${encodeURIComponent(id)}`
    )
  ).data;
}

export async function lepGetCampaignStatus(id: string) {
  const res = await API.get<{
    ok: boolean;
    source?: string;
    lepBaseUrl?: string;
    status?: number;
    data?: LepCampaignStatus;
  }>(`/admin/lep/campaigns/${encodeURIComponent(id)}/status`);
  return res.data;
}

export async function lepListCampaignSchedules(campaignId: string) {
  return (
    await API.get<{
      ok: boolean;
      data: { campaignId: string; schedules: LepCampaignSchedule[] };
    }>(`/admin/lep/campaigns/${encodeURIComponent(campaignId)}/schedules`)
  ).data;
}

export async function lepCreateCampaignSchedule(
  campaignId: string,
  payload: {
    cron: string;
    timezone: string;
    startAt?: string;
    endAt?: string;
    idempotencyKey?: string;
  }
) {
  return (
    await API.post(
      `/admin/lep/campaigns/${encodeURIComponent(campaignId)}/schedules`,
      payload
    )
  ).data as any;
}

export async function lepUpdateCampaignSchedule(
  campaignId: string,
  scheduleId: string,
  payload: Partial<{
    cron: string;
    timezone: string;
    startAt?: string | null;
    endAt?: string | null;
    enabled?: boolean;
    idempotencyKey?: string;
  }>
) {
  return (
    await API.patch(
      `/admin/lep/campaigns/${encodeURIComponent(campaignId)}/schedules/${encodeURIComponent(
        scheduleId
      )}`,
      payload
    )
  ).data as any;
}

export async function lepDeleteCampaignSchedule(
  campaignId: string,
  scheduleId: string
) {
  return (
    await API.delete(
      `/admin/lep/campaigns/${encodeURIComponent(campaignId)}/schedules/${encodeURIComponent(
        scheduleId
      )}`
    )
  ).data as any;
}

/* ============================= Telegram Live ============================ */

export async function startTelegramLive(payload: {
  channelId: string;
  title: string;
  description?: string;
  botToken?: string;
}) {
  return (await API.post("/admin/telegram/live/start", payload)).data as any;
}

export async function submitLiveQuestion(payload: {
  liveStreamId: string;
  question: string;
  userId?: string;
}) {
  return (await API.post("/admin/telegram/live/qna", payload)).data as any;
}

export async function createLivePoll(payload: {
  liveStreamId: string;
  question: string;
  options: string[];
  channelId?: string;
  botToken?: string;
}) {
  return (await API.post("/admin/telegram/live/poll", payload)).data as any;
}

export async function getLiveSummary() {
  return (
    await API.get<{ ok: boolean; streams: LiveStream[] }>(
      "/admin/telegram/live/summary"
    )
  ).data;
}

export type AdminUploadResult = {
  ok: true;
  url: string;
  fileName: string;
  mime: string;
  size: number;
};

export async function uploadAdminUpload(
  file: File
): Promise<AdminUploadResult> {
  const fd = new FormData();
  fd.append("file", file, file.name);

  // ใช้ axios instance เดิมของโปรเจกต์ (API)
  const r = await API.post(`/admin/uploads`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  if (!r.data?.ok) throw new Error(r.data?.message || "upload_failed");
  return r.data as AdminUploadResult;
}

export async function searchChatMessages(params: {
  q: string;
  botId?: string | null;
  sessionId?: string | null;
  conversationId?: string | null;
  limit?: number;
  offset?: number;
}): Promise<{ items: ChatMessage[]; conversationId: string | null }> {
  const res = await API.get("/admin/chat/messages", {
    params: {
      q: params.q,
      botId: params.botId ?? undefined,
      sessionId: params.sessionId ?? undefined,
      conversationId: params.conversationId ?? undefined,
      limit: params.limit ?? 200,
      offset: params.offset ?? 0,
    },
  });

  const data: any = res.data;
  const items = (data.items ?? data.messages ?? []).map(normalizeChatMessage);

  return {
    conversationId: data.conversationId ?? null,
    items,
  };
}
// ===================== DailyRule / CodePool =====================

export type RuleStockResponse = {
  ok: true;
  ruleId: string;
  available: number;
  used: number;
  total: number;
};

export async function getRuleStock(ruleId: string) {
  const { data } = await API.get<RuleStockResponse>(
    `/admin/rules/${ruleId}/stock`
  );
  return data;
}

export async function generateRuleCodes(
  ruleId: string,
  payload: { count: number; prefix?: string; digits?: number }
) {
  const { data } = await API.post<{
    ok: true;
    ruleId: string;
    generated: number;
  }>(`/admin/rules/${ruleId}/codepool/generate`, payload);
  return data;
}

// ส่งเป็น codesText (string) เท่านั้น
export async function importRuleCodes(ruleId: string, codesText: string) {
  const { data } = await API.post<{
    ok: true;
    ruleId: string;
    input: number;
    uniqueInput: number;
    imported: number;
    duplicated: number;
  }>(`/admin/rules/${ruleId}/codepool/import`, { codesText });
  return data;
}

/* ============================= Helper bundle ============================ */

export const api = {
  base: getApiBase(),
  health: async () => (await API.get<Health>("/health")).data,

  // Auth
  login,
  logoutAndRedirect,

  // Stats
  daily: getDailyByBot,
  range: getRangeByBot,
  chatMetrics: getChatMetrics,
  caseMetrics: getCaseMetrics,
  recent: getRecentByBot,
  dailyTenant: getDailyStats,
  adminCases: listAdminCases,
  getAdminCase,
  updateAdminCase,

  // Bots
  bots: getBots,
  createBot: initBot,
  getBot,
  updateBotMeta,
  deleteBot,

  // Secrets
  getBotSecrets,
  updateBotSecrets,

  // Dev
  devLinePing,

  // Intents
  getBotIntents,
  createBotIntent,
  updateBotIntent,
  deleteBotIntent,

  // AI Config
  getBotConfig,
  updateBotConfig,

  // Chat Center
  getChatSessions,
  getChatMessages,
  getChatMessagesByQuery,
  replyChatSession,
  searchChatMessages: getChatMessagesByQuery,
  updateChatSession,
  updateChatSessionMeta,
  sendRichMessage,

  // FAQ & Engagement
  getFaqEntries,
  createFaqEntry,
  updateFaqEntry,
  deleteFaqEntry,
  getEngagementMessages,
  createEngagementMessage,
  updateEngagementMessage,
  deleteEngagementMessage,

  // Knowledge
  listKnowledgeDocs,
  getKnowledgeDoc,
  createKnowledgeDoc,
  updateKnowledgeDoc,
  deleteKnowledgeDoc,
  listKnowledgeChunks,
  createKnowledgeChunk,
  updateKnowledgeChunk,
  deleteKnowledgeChunk,
  getBotKnowledge,
  addBotKnowledge,
  removeBotKnowledge,

  // LEP
  lepHealth,
  lepListCampaigns,
  lepCreateCampaign,
  lepQueueCampaign,
  lepGetCampaign,
  lepGetCampaignStatus,
  lepListCampaignSchedules,
  lepCreateCampaignSchedule,
  lepUpdateCampaignSchedule,
  lepDeleteCampaignSchedule,

  // Live
  startTelegramLive,
  submitLiveQuestion,
  createLivePoll,
  getLiveSummary,
};

/* ============================== Knowledge Types ============================== */
