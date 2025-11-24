import React, { useState, useEffect } from "react";

export type BotConfig = {
  model: string;
  systemPrompt: string;
  temperature: number;
  topP: number;
  maxTokens: number;
};

type Props = {
  config: BotConfig;
  onChange: (next: BotConfig) => void;
  onSave: (next: BotConfig) => Promise<void> | void;
  saving: boolean;
};

const ALLOWED_MODELS = [
  "gpt-4o-mini",
  "gpt-4o",
  "o4-mini",
  "gpt-3.5-turbo",
];

export const BotAiConfigSection: React.FC<Props> = ({
  config,
  onChange,
  onSave,
  saving,
}) => {
  const [draft, setDraft] = useState<BotConfig>(config);

  useEffect(() => {
    setDraft(config);
  }, [config]);

  const handleField =
    (field: keyof BotConfig) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      let value: string | number = e.target.value;
      if (field === "temperature" || field === "topP" || field === "maxTokens") {
        value = Number(value);
      }
      const next = { ...draft, [field]: value } as BotConfig;
      setDraft(next);
      onChange(next);
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(draft);
  };

  return (
    <section className="rounded-2xl border border-gray-700 bg-gray-900/80 p-4 md:p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-white">AI Config</h2>
        <span className="text-xs text-gray-400">
          ตั้งค่าพี่พลอยสำหรับบอทตัวนี้
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-300">
              Model
            </label>
            <select
              className="w-full rounded-lg border border-gray-700 bg-gray-950/60 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
              value={draft.model}
              onChange={handleField("model")}
            >
              {ALLOWED_MODELS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-300">
              Temperature
            </label>
            <input
              type="number"
              min={0}
              max={1}
              step={0.1}
              className="w-full rounded-lg border border-gray-700 bg-gray-950/60 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
              value={draft.temperature}
              onChange={handleField("temperature")}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-300">
              Top P
            </label>
            <input
              type="number"
              min={0}
              max={1}
              step={0.1}
              className="w-full rounded-lg border border-gray-700 bg-gray-950/60 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
              value={draft.topP}
              onChange={handleField("topP")}
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-300">
              Max Tokens
            </label>
            <input
              type="number"
              min={100}
              max={4000}
              step={50}
              className="w-full rounded-lg border border-gray-700 bg-gray-950/60 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
              value={draft.maxTokens}
              onChange={handleField("maxTokens")}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-300">
            System Prompt (Persona / กฎสำหรับพี่พลอย)
          </label>
          <textarea
            rows={5}
            className="w-full rounded-lg border border-gray-700 bg-gray-950/60 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
            placeholder="เช่น พี่พลอยเป็นแอดมิน BN9 ที่ตอบลูกค้าอย่างสุภาพ อธิบายชัดเจน ฯลฯ"
            value={draft.systemPrompt}
            onChange={handleField("systemPrompt")}
          />
          <p className="text-[11px] text-gray-500">
            Prompt นี้จะถูกใช้ทุกครั้งที่บอทตัวนี้เรียก GPT
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
          >
            {saving ? "กำลังบันทึก..." : "บันทึก AI Config"}
          </button>
        </div>
      </form>
    </section>
  );
};
