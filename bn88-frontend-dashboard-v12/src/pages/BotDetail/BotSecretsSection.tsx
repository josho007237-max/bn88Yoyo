import React, { useState, useEffect } from "react";

export type BotSecrets = {
  openaiApiKey?: string | null;
  lineAccessToken?: string | null;
  lineChannelSecret?: string | null;
};

type Props = {
  secrets: BotSecrets;
  onChange: (next: BotSecrets) => void;
  onSave: (next: BotSecrets) => Promise<void> | void;
  saving: boolean;
};

export const BotSecretsSection: React.FC<Props> = ({
  secrets,
  onChange,
  onSave,
  saving,
}) => {
  const [draft, setDraft] = useState<BotSecrets>(secrets);

  useEffect(() => {
    setDraft(secrets);
  }, [secrets]);

  const handleField =
    (field: keyof BotSecrets) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value || null;
      const next = { ...draft, [field]: value };
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
        <h2 className="text-lg font-semibold text-white">Secrets</h2>
        <span className="text-xs text-gray-400">
          ข้อมูลสำคัญ (ไม่แชร์ให้คนอื่นเห็น)
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-300">
            OpenAI API Key
          </label>
          <input
            type="password"
            className="w-full rounded-lg border border-gray-700 bg-gray-950/60 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
            placeholder="sk-..."
            value={draft.openaiApiKey ?? ""}
            onChange={handleField("openaiApiKey")}
          />
          <p className="text-[11px] text-gray-500">
            ใช้สำหรับให้บอทเรียก GPT (พี่พลอย) เพื่อสร้างคำตอบอัตโนมัติ
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-300">
              LINE Channel Access Token
            </label>
            <input
              type="password"
              className="w-full rounded-lg border border-gray-700 bg-gray-950/60 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
              placeholder="line access token"
              value={draft.lineAccessToken ?? ""}
              onChange={handleField("lineAccessToken")}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-300">
              LINE Channel Secret
            </label>
            <input
              type="password"
              className="w-full rounded-lg border border-gray-700 bg-gray-950/60 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
              placeholder="line channel secret"
              value={draft.lineChannelSecret ?? ""}
              onChange={handleField("lineChannelSecret")}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pt-2">
          <p className="text-[11px] text-gray-500">
            เมื่อบันทึกแล้ว ระบบจะใช้ค่าเหล่านี้ในการ Verify LINE Webhook
            และตอบกลับลูกค้า
          </p>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
          >
            {saving ? "กำลังบันทึก..." : "บันทึก Secrets"}
          </button>
        </div>
      </form>
    </section>
  );
};
