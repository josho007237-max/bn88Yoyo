// src/lib/admin.ts
const BASE = import.meta.env.VITE_API_BASE || "/api";
const TENANT = import.meta.env.VITE_TENANT || "bn9";

export type LoginResp = { token: string };
export type BotRow = {
  id: string;
  tenant: string;
  name: string;
  provider: "line" | "telegram" | "facebook" | string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  secrets?: {
    hasSecret: boolean;
    channelSecret?: string | null;
    channelAccessToken?: string | null;
  } | null;
};
export type BotsResp = { ok: boolean; items: BotRow[] };

export const auth = {
  get token() {
    return localStorage.getItem("BN9_ADMIN_JWT") || "";
  },
  set token(v: string) {
    localStorage.setItem("bn9.admin.token", v);
  },
  clear() {
    localStorage.removeItem("BN9_ADMIN_JWT");
  },
};

function h() {
  const headers: Record<string, string> = { "x-tenant": TENANT };
  if (auth.token) headers.Authorization = `Bearer ${auth.token}`;
  return headers;
}
async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...h(),
      ...(init?.headers || {}),
    },
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text().catch(() => "")}`);
  return r.json() as Promise<T>;
}

export async function login(email: string, password: string) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`login_failed: ${res.status}`);
  const data = (await res.json()) as LoginResp;
  auth.token = data.token;
  return data;
}

export async function listBots() {
  return j<BotsResp>("/api/admin/bots");
}

export async function createBot(
  name: string,
  provider: "line" | "telegram" | "facebook" = "line"
) {
  return j<{ ok: boolean; id: string }>("/api/admin/bots", {
    method: "POST",
    body: JSON.stringify({ name, provider, isActive: true }),
  });
}

export async function saveLineSecrets(
  botId: string,
  channelSecret: string,
  channelAccessToken: string
) {
  return j<{ ok: boolean; botId: string; saved: boolean }>(
    `/api/admin/bots/${encodeURIComponent(botId)}/secrets`,
    {
      method: "PUT",
      body: JSON.stringify({ channelSecret, channelAccessToken }),
    }
  );
}

export async function health() {
  return j<{ ok: boolean; time: string; adminApi?: boolean }>("/api/health");
}
