const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:3000";

async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, init);
  if (!r.ok) throw new Error(`${r.status} ${await r.text().catch(()=> "")}`);
  return r.json();
}

export type Health = { ok: boolean; time: string; adminApi?: boolean };

export type StatDaily = {
  botId: string; dateKey: string; total: number; text: number; follow: number; unfollow: number;
};
export type DailyResp = { ok: boolean; dateKey: string; stats: StatDaily };

export type CaseItem = {
  id: string; botId: string; userId?: string | null; text?: string | null;
  kind?: string | null; createdAt?: string;
};
export type RecentResp = { ok: boolean; items: CaseItem[] };

export const api = {
  health: () => j<Health>("/api/health"),
  daily:  (botId: string) => j<DailyResp>(`/api/stats/daily?botId=${encodeURIComponent(botId)}`),
  recent: (botId: string, limit = 20) =>
    j<RecentResp>(`/api/cases/recent?botId=${encodeURIComponent(botId)}&limit=${limit}`),
  base: API_BASE,
};
