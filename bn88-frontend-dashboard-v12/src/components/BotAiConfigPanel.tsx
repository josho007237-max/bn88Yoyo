// src/components/BotAiConfigPanel.tsx
import type React from "react";
import { useEffect, useState } from "react";
import {
  getBotConfig,
  updateBotConfig,
  type BotAiConfig,
} from "../lib/api";

type Props = {
  botId: string;
};

type LocalState = {
  model: string;
  systemPrompt: string;
  temperature: string;
  topP: string;
  maxTokens: string;
};

const BotAiConfigPanel: React.FC<Props> = ({ botId }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [allowedModels, setAllowedModels] = useState<string[]>([]);
  const [config, setConfig] = useState<BotAiConfig | null>(null);
  const [form, setForm] = useState<LocalState>({
    model: "",
    systemPrompt: "",
    temperature: "0.3",
    topP: "1",
    maxTokens: "800",
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setSuccess(null);
      try {
        const data = await getBotConfig(botId); // { ok, config, allowedModels }
        if (cancelled) return;
        setConfig(data.config);
        setAllowedModels(data.allowedModels || []);
        setForm({
          model: data.config.model,
          systemPrompt: data.config.systemPrompt ?? "",
          temperature: String(data.config.temperature ?? 0.3),
          topP: String(data.config.topP ?? 1),
          maxTokens: String(data.config.maxTokens ?? 800),
        });
      } catch (err: any) {
        console.error("load config error:", err);
        setError("โหลด AI Config ไม่สำเร็จ");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [botId]);

  function change<K extends keyof LocalState>(k: K, v: string) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  function num(v: string, def: number) {
    const n = Number(v);
    return Number.isNaN(n) ? def : n;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        model: form.model,
        systemPrompt: form.systemPrompt,
        temperature: num(form.temperature, 0.3),
        topP: num(form.topP, 1),
        maxTokens: num(form.maxTokens, 800),
      };
      const res = await updateBotConfig(botId, payload);
      setConfig(res.config);
      setSuccess("บันทึก AI Config สำเร็จ");
    } catch (err: any) {
      console.error("save config error:", err);
      setError("บันทึก AI Config ไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-zinc-50">
            AI Config / Persona
          </h2>
          <p className="text-sm text-zinc-400">
            ตั้งค่าพฤติกรรมของบอทตัวนี้ (โมเดล, System prompt, temperature ฯลฯ)
          </p>
        </div>
        {loading && (
          <span className="text-xs text-zinc-500">กำลังโหลด...</span>
        )}
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-red-500/60 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-3 rounded-lg border border-emerald-500/60 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {success}
        </div>
      )}

      {!loading && (
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="grid gap-2">
            <label className="text-sm font-medium text-zinc-200">
              Model ที่ใช้
            </label>
            <select
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500"
              value={form.model}
              onChange={(e) => change("model", e.target.value)}
            >
              <option value="">-- เลือกโมเดล --</option>
              {allowedModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium text-zinc-200">
              System Prompt / Persona
            </label>
            <textarea
              className="min-h-[120px] w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500"
              value={form.systemPrompt}
              onChange={(e) => change("systemPrompt", e.target.value)}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="grid gap-1">
              <label className="text-sm font-medium text-zinc-200">
                Temperature
              </label>
              <input
                type="number"
                step={0.1}
                min={0}
                max={2}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500"
                value={form.temperature}
                onChange={(e) => change("temperature", e.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <label className="text-sm font-medium text-zinc-200">top_p</label>
              <input
                type="number"
                step={0.1}
                min={0}
                max={1}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500"
                value={form.topP}
                onChange={(e) => change("topP", e.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <label className="text-sm font-medium text-zinc-200">
                Max tokens
              </label>
              <input
                type="number"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500"
                value={form.maxTokens}
                onChange={(e) => change("maxTokens", e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-900 shadow disabled:opacity-60"
            >
              {saving ? "กำลังบันทึก..." : "บันทึก AI Config"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default BotAiConfigPanel;
