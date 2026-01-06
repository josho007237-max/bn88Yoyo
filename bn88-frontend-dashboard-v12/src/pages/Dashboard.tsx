// src/pages/Dashboard.tsx
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { api, type Health, type DailyResp, type CaseItem } from "../lib/api";
import connectEvents from "../lib/events";
import { BotSwitcher } from "@/components/BotSwitcher";

const TENANT = import.meta.env.VITE_TENANT ?? "bn9";

const pick = (...vals: Array<string | null | undefined>) =>
  vals.find((v) => typeof v === "string" && v.trim() !== "") ?? "-";

// อ่าน/เขียน BOT_ID รองรับคีย์เก่า/ใหม่
function getInitialBotId() {
  const legacy = localStorage.getItem("BN9_BOT_ID");
  if (legacy) {
    localStorage.setItem("BOT_ID", legacy);
    localStorage.removeItem("BN9_BOT_ID");
  }
  return (
    localStorage.getItem("BOT_ID") ||
    (import.meta as any).env.VITE_DEFAULT_BOT_ID ||
    ""
  );
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800">
      <div className="text-xs opacity-70">{label}</div>
      <div className="text-2xl font-bold mt-1.5">{value}</div>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800">
      <div className="mb-3 font-semibold">{title}</div>
      {children}
    </div>
  );
}

export default function Dashboard() {
  const [botId, setBotId] = useState<string>(getInitialBotId());
  const [health, setHealth] = useState<Health | null>(null);
  const [daily, setDaily] = useState<DailyResp | null>(null);
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [loading, setLoading] = useState(false);

  // debounce กัน refresh ถี่ ๆ
  const debounceRef = useRef<number | null>(null);
  const debounce = (fn: () => void, ms = 250) => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(fn, ms);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, []);

  const loadAll = useCallback(
    async (id?: string) => {
      const target = id ?? botId;
      if (!target) return;
      setLoading(true);
      try {
        const [h, d, r] = await Promise.all([
          api.health(),
          api.daily(target),
          api.recent(target, 20),
        ]);
        setHealth(h);
        setDaily(d);
        setCases(Array.isArray(r?.items) ? r.items : []);
      } catch (e) {
        console.error(e);
        alert("โหลดข้อมูลไม่สำเร็จ: ตรวจ VITE_API_BASE / BOT_ID / CORS");
      } finally {
        setLoading(false);
      }
    },
    [botId]
  );

  // โหลดครั้งแรก + ทุกครั้งที่เปลี่ยนบอท
  useEffect(() => {
    if (botId) loadAll(botId);
    const t = setInterval(() => botId && loadAll(botId), 30000);
    return () => clearInterval(t);
  }, [botId, loadAll]);

  // SSE – live update เฉพาะบอทที่กำลังดู
  useEffect(() => {
    if (!botId) return;

    const disconnect = connectEvents({
      tenant: TENANT,
      onHello: () => {},
      onPing: () => {},
      onCaseNew: (e: any) => {
        if (e?.botId === botId) {
          debounce(() => loadAll(botId));
          (globalThis as any)?.toast?.success?.("Live update");
        }
      },
      onStatsUpdate: (e: any) => {
        if (e?.botId === botId) {
          debounce(() => loadAll(botId));
          (globalThis as any)?.toast?.success?.("Live update");
        }
      },
    });

    return () => {
      try {
        disconnect && disconnect();
      } catch {
        /* ignore */
      }
    };
  }, [botId, loadAll]);

  const chartData = useMemo(() => {
    if (!daily?.stats) return [];
    const s = daily.stats;
    return [
      {
        date: daily.dateKey || new Date().toISOString().slice(0, 10),
        total: s.total ?? 0,
        text: s.text ?? 0,
        follow: s.follow ?? 0,
        unfollow: s.unfollow ?? 0,
      },
    ];
  }, [daily]);

  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);

  return (
    <div className="min-h-screen bg-[#111214] text-zinc-100 p-6">
      <div className="max-w-5xl mx-auto grid gap-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-extrabold m-0">BN9 – Dashboard</h1>
            <div className="opacity-70 text-xs mt-1">
              API: {api.base} | Bot: {botId || "-"}
            </div>
            {health && (
              <div className="opacity-60 text-[11px] mt-1">
                Health ok at {health.time}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <BotSwitcher
              onChange={(id) => {
                localStorage.setItem("BOT_ID", id);
                setBotId(id);
                if (id) loadAll(id);
              }}
            />
            <button
              type="button"
              onClick={() => botId && loadAll(botId)}
              disabled={loading || !botId}
              className="px-4 py-2 rounded-xl bg-zinc-800 border border-zinc-700"
            >
              รีเฟรช
            </button>
          </div>
        </div>

        {/* Banner ถ้ายังไม่ได้เลือก BOT */}
        {!botId && (
          <div className="p-3 rounded-xl bg-amber-900/30 border border-amber-700 text-sm">
            โปรดเลือกบอทที่มุมขวาบนก่อน ระบบจะโหลดเคส/สถิติของบอทนั้นอัตโนมัติ
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="วันนี้" value={daily?.dateKey || todayKey} />
          <Kpi label="ข้อความทั้งหมด" value={daily?.stats?.total ?? 0} />
          <Kpi label="ข้อความ (text)" value={daily?.stats?.text ?? 0} />
          <Kpi
            label="ติดตาม/เลิกติดตาม"
            value={`${daily?.stats?.follow ?? 0} / ${
              daily?.stats?.unfollow ?? 0
            }`}
          />
        </div>

        {/* Chart */}
        <Card title="Daily Overview (today)">
          <div className="w-full h-[300px] min-h-[300px]">
            {chartData.length === 0 ? (
              <div className="h-full grid place-items-center text-sm opacity-60">
                ยังไม่มีข้อมูลวันนี้
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="4 4" />
                  <XAxis dataKey="date" />
                  <YAxis allowDecimals={false} domain={[0, "dataMax + 2"]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="total" dot />
                  <Line type="monotone" dataKey="text" dot />
                  <Line type="monotone" dataKey="follow" dot />
                  <Line type="monotone" dataKey="unfollow" dot />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="mt-2 text-center text-xs opacity-60">
            • total • text • follow • unfollow
          </div>
        </Card>

        {/* Recent Cases */}
        <Card title="Recent Cases (ล่าสุด 20 รายการ)">
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-sm">
              <thead className="opacity-80">
                <tr>
                  <th className="text-left p-2">เวลา</th>
                  <th className="text-left p-2">ผู้ใช้</th>
                  <th className="text-left p-2">ประเภท</th>
                  <th className="text-left p-2">ข้อความ</th>
                </tr>
              </thead>
              <tbody>
                {!cases || cases.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-3 opacity-60 text-center">
                      — ยังไม่มีรายการ —
                    </td>
                  </tr>
                ) : (
                  cases.map((c) => {
                    const when = c.createdAt ? new Date(c.createdAt) : null;
                    return (
                      <tr key={c.id} className="border-t border-zinc-800">
                        <td className="p-2 whitespace-nowrap">
                          {when ? when.toLocaleString() : "-"}
                        </td>
                        <td className="p-2">{pick(c.userId)}</td>
                        <td className="p-2">
                          {pick((c as any).kind, (c as any).type)}
                        </td>
                        <td className="p-2">
                          {pick((c as any).text, (c as any).message)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
