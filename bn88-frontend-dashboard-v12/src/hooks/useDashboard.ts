// src/hooks/useDashboard.ts
import { useCallback, useEffect, useState } from "react";
import { api, type Health, type DailyResp, type CaseItem } from "../lib/api";

export type UseDashboardState = {
  health: Health | null;
  daily: DailyResp | null;
  cases: CaseItem[];
  loading: boolean;
  error: string | null;
};

export function useDashboard(botId: string) {
  const [state, setState] = useState<UseDashboardState>({
    health: null,
    daily: null,
    cases: [],
    loading: false,
    error: null,
  });

  const loadAll = useCallback(async (id: string) => {
    if (!id) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const [h, d, r] = await Promise.all([
        api.health(),
        api.daily(id),      // DailyResp (วันนี้)
        api.recent(id, 20), // { items: CaseItem[] }
      ]);
      setState({
        health: h,
        daily: d,
        cases: Array.isArray(r?.items) ? r.items : [],
        loading: false,
        error: null,
      });
    } catch (e: any) {
      setState((s) => ({
        ...s,
        loading: false,
        error: e?.message || "โหลดข้อมูลไม่สำเร็จ",
      }));
    }
  }, []);

  useEffect(() => {
    if (botId) loadAll(botId);
  }, [botId, loadAll]);

  return { ...state, reload: () => botId && loadAll(botId) };
}

export default useDashboard;
