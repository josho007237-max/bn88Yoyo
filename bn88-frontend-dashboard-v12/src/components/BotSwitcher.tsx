// src/components/BotSwitcher.tsx
import { useEffect, useState } from "react";

type BotItem = {
  id: string;
  name?: string | null;
  platform?: string | null; // "line" | ...
};

const STORAGE_KEY = "BOT_ID";

// normalize API root (กัน /api ซ้อน /api และรองรับ relative)
function getApiRoot() {
  const raw = (import.meta.env?.VITE_API_BASE || "").trim().replace(/\/+$/, "");
  if (!raw) return "/api"; // ให้ Vite proxy
  if (/^https?:\/\//i.test(raw)) return raw.endsWith("/api") ? raw : `${raw}/api`;
  const cleaned = raw.startsWith("/") ? raw : `/${raw}`;
  return cleaned.endsWith("/api") ? cleaned : `${cleaned}/api`;
}

export function BotSwitcher({ onChange }: { onChange?: (id: string) => void }) {
  const [bots, setBots] = useState<BotItem[]>([]);
  const [botId, setBotId] = useState<string>(() => {
    try { return localStorage.getItem(STORAGE_KEY) || ""; } catch { return ""; }
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    const url = `${getApiRoot()}/bots`;

    setLoading(true);
    fetch(url, { signal: ctrl.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((x) => {
        const items: BotItem[] = Array.isArray(x) ? x : x?.items ?? [];
        setBots(items);

        if (!botId && items.length) {
          const first = items[0].id;
          setBotId(first);
          try { localStorage.setItem(STORAGE_KEY, first); } catch {}
          onChange?.(first);
        }
      })
      .catch((err) => {
        if (err?.name !== "AbortError") {
          console.error("[BotSwitcher] load bots error:", err);
        }
      })
      .finally(() => setLoading(false));

    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectId = "bot-switcher-select";

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={selectId} className="text-sm text-gray-500">
        เลือกบอท:
      </label>

      <select
        id={selectId}
        title="เลือกบอท"
        aria-label="เลือกบอท"
        className="border rounded-md p-1 text-sm bg-zinc-900 border-zinc-700"
        value={botId}
        onChange={(e) => {
          const id = e.target.value;
          setBotId(id);
          try { localStorage.setItem(STORAGE_KEY, id); } catch {}
          onChange?.(id);
        }}
        disabled={loading || bots.length === 0}
      >
        {bots.length === 0 && <option value="">(ไม่มีบอท)</option>}
        {bots.map((b) => (
          <option key={b.id} value={b.id}>
            {(b.name || b.id) + (b.platform ? ` (${b.platform})` : "")}
          </option>
        ))}
      </select>
    </div>
  );
}
