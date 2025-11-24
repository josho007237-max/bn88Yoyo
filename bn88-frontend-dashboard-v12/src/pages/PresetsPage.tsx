import React, { useEffect, useMemo, useState } from "react";

/** ---------- CONFIG ---------- */
const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";
const getToken = () => localStorage.getItem("token") ?? "";
const getTenant = () => localStorage.getItem("tenant") ?? "bn9";

type Preset = {
  id: string;
  tenant: string;
  name: string;
  model: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  systemPrompt: string;
  createdAt: string;
  updatedAt: string;
};

type BotItem = {
  id: string;
  tenant: string;
  name: string;
  platform: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type ApiList<T> = { ok: true; items: T[] };
type ApiOne<T> = { ok: true; item: T };

/** ---------- helpers ---------- */
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
      "x-tenant": getTenant(),
      ...(init?.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok || data?.ok === false) {
    const msg = data?.message ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}

/** ---------- component ---------- */
export default function PresetsPage() {
  // listing
  const [items, setItems] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // create
  const [cName, setCName] = useState("Ploy Friendly v1");
  const [cModel, setCModel] = useState("gpt-4o-mini");
  const [cTemp, setCTemp] = useState(0.6);
  const [cTopP, setCTopP] = useState(1);
  const [cMax, setCMax] = useState(800);
  const [cSys, setCSys] = useState("You are P'Ploy, friendly and helpful assistant...");

  // apply-to-bot dialog
  const [bots, setBots] = useState<BotItem[]>([]);
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyPreset, setApplyPreset] = useState<Preset | null>(null);
  const [applyBotId, setApplyBotId] = useState<string>("");
  const [ovTemp, setOvTemp] = useState<string>("");   // optional overrides
  const [ovTopP, setOvTopP] = useState<string>("");
  const [ovMax, setOvMax] = useState<string>("");

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await api<ApiList<Preset>>("/api/admin/ai/presets");
      setItems(res.items);
    } catch (e: any) {
      setErr(e.message || "load_error");
    } finally {
      setLoading(false);
    }
  };

  const loadBots = async () => {
    const res = await api<ApiList<BotItem>>("/api/admin/bots");
    setBots(res.items);
  };

  useEffect(() => {
    load();
  }, []);

  const applyDisabled = useMemo(() => !applyPreset || !applyBotId, [applyPreset, applyBotId]);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api<ApiOne<Preset>>("/api/admin/ai/presets", {
        method: "POST",
        body: JSON.stringify({
          name: cName.trim(),
          model: cModel.trim(),
          temperature: Number(cTemp),
          topP: Number(cTopP),
          maxTokens: Number(cMax),
          systemPrompt: cSys,
        }),
      });
      await load();
      alert("Created preset ✓");
    } catch (e: any) {
      alert("Create failed: " + e.message);
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("Delete this preset?")) return;
    try {
      await api(`/api/admin/ai/presets/${id}`, { method: "DELETE" });
      setItems(items.filter((x) => x.id !== id));
    } catch (e: any) {
      alert("Delete failed: " + e.message);
    }
  };

  const openApply = async (p: Preset) => {
    setApplyPreset(p);
    setApplyBotId("");
    setOvTemp("");
    setOvTopP("");
    setOvMax("");
    setApplyOpen(true);
    await loadBots();
  };

  const doApply = async () => {
    if (!applyPreset || !applyBotId) return;
    try {
      const payload: any = { presetId: applyPreset.id };
      if (ovTemp !== "") payload.temperature = Number(ovTemp);
      if (ovTopP !== "") payload.topP = Number(ovTopP);
      if (ovMax !== "") payload.maxTokens = Number(ovMax);

      await api(`/api/admin/bots/${applyBotId}/config`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      alert("Applied preset to bot ✓");
      setApplyOpen(false);
    } catch (e: any) {
      alert("Apply failed: " + e.message);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">AI Presets</h1>

      {/* create card */}
      <form onSubmit={onCreate} className="grid gap-3 bg-neutral-900/40 border border-neutral-800 rounded-xl p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="grid gap-1">
            <span className="text-sm text-neutral-300">Name</span>
            <input className="input" value={cName} onChange={(e) => setCName(e.target.value)} required />
          </label>
          <label className="grid gap-1">
            <span className="text-sm text-neutral-300">Model</span>
            <input className="input" value={cModel} onChange={(e) => setCModel(e.target.value)} required />
          </label>
          <label className="grid gap-1">
            <span className="text-sm text-neutral-300">Max Tokens</span>
            <input className="input" type="number" min={1} value={cMax} onChange={(e) => setCMax(Number(e.target.value))} />
          </label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="grid gap-1">
            <span className="text-sm text-neutral-300">Temperature</span>
            <input className="input" type="number" step="0.1" min="0" max="2" value={cTemp} onChange={(e) => setCTemp(Number(e.target.value))} />
          </label>
          <label className="grid gap-1">
            <span className="text-sm text-neutral-300">TopP</span>
            <input className="input" type="number" step="0.1" min="0" max="1" value={cTopP} onChange={(e) => setCTopP(Number(e.target.value))} />
          </label>
          <div />
        </div>
        <label className="grid gap-1">
          <span className="text-sm text-neutral-300">System Prompt</span>
          <textarea className="input h-24" value={cSys} onChange={(e) => setCSys(e.target.value)} />
        </label>
        <div>
          <button type="submit" className="btn-primary">Create Preset</button>
        </div>
      </form>

      {/* list */}
      <div className="bg-neutral-900/40 border border-neutral-800 rounded-xl">
        <div className="p-3 border-b border-neutral-800 flex items-center justify-between">
          <div className="font-semibold">Presets</div>
          <button onClick={load} className="btn-secondary text-sm">Refresh</button>
        </div>

        {loading ? (
          <div className="p-6 text-neutral-400">Loading…</div>
        ) : err ? (
          <div className="p-6 text-red-400">Error: {err}</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-neutral-400">
              <tr className="[&>th]:px-3 [&>th]:py-2 border-b border-neutral-800">
                <th>Name</th><th>Model</th><th>Temp</th><th>TopP</th><th>Max</th><th>Updated</th><th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="[&>td]:px-3 [&>td]:py-2 border-b border-neutral-800">
                  <td className="font-medium">{p.name}</td>
                  <td>{p.model}</td>
                  <td>{p.temperature}</td>
                  <td>{p.topP}</td>
                  <td>{p.maxTokens}</td>
                  <td>{new Date(p.updatedAt).toLocaleString()}</td>
                  <td className="flex gap-2 justify-end">
                    <button onClick={() => openApply(p)} className="btn-primary">Apply to bot</button>
                    <button onClick={() => onDelete(p.id)} className="btn-danger">Delete</button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-6 text-neutral-400">No presets.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* apply dialog */}
      {applyOpen && applyPreset && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-xl p-4 grid gap-3">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Apply preset: {applyPreset.name}</div>
              <button className="btn-secondary" onClick={() => setApplyOpen(false)}>Close</button>
            </div>
            <label className="grid gap-1">
              <span className="text-sm text-neutral-300">Bot</span>
              <select className="input" value={applyBotId} onChange={(e) => setApplyBotId(e.target.value)}>
                <option value="">-- select bot --</option>
                {bots.map((b) => (
                  <option key={b.id} value={b.id}>{b.name} ({b.platform})</option>
                ))}
              </select>
            </label>
            <div className="text-neutral-400 text-xs">Optional overrides (เว้นว่าง = ใช้ค่าจาก preset)</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="grid gap-1">
                <span className="text-sm text-neutral-300">Temperature</span>
                <input className="input" type="number" step="0.1" min="0" max="2" value={ovTemp} onChange={(e) => setOvTemp(e.target.value)} placeholder={`${applyPreset.temperature}`} />
              </label>
              <label className="grid gap-1">
                <span className="text-sm text-neutral-300">TopP</span>
                <input className="input" type="number" step="0.1" min="0" max="1" value={ovTopP} onChange={(e) => setOvTopP(e.target.value)} placeholder={`${applyPreset.topP}`} />
              </label>
              <label className="grid gap-1">
                <span className="text-sm text-neutral-300">Max Tokens</span>
                <input className="input" type="number" min={1} value={ovMax} onChange={(e) => setOvMax(e.target.value)} placeholder={`${applyPreset.maxTokens}`} />
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setApplyOpen(false)}>Cancel</button>
              <button disabled={applyDisabled} className="btn-primary disabled:opacity-50" onClick={doApply}>Apply</button>
            </div>
          </div>
        </div>
      )}

      {/* local styles */}
      <style>{`
        .input{background:#0b0b0b;border:1px solid #2a2a2a;border-radius:.6rem;padding:.5rem .7rem;color:#eaeaea}
        .btn-primary{background:#2563eb;border:1px solid #1d4ed8;color:white;padding:.45rem .75rem;border-radius:.6rem}
        .btn-secondary{background:#111827;border:1px solid #374151;color:#e5e7eb;padding:.45rem .75rem;border-radius:.6rem}
        .btn-danger{background:#8b0000;border:1px solid #a30808;color:#fff;padding:.45rem .75rem;border-radius:.6rem}
      `}</style>
    </div>
  );
}
