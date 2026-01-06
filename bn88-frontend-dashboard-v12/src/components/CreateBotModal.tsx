// src/components/CreateBotModal.tsx
import { useEffect, useId, useState } from "react";
import { initBot, updateBotSecrets } from "../lib/api";

type Form = {
  name: string;
  openaiApiKey: string;
  lineAccessToken: string;
  lineChannelSecret: string;
};

type Errs = Partial<Record<keyof Form, string>>;

const EMPTY: Form = {
  name: "",
  openaiApiKey: "",
  lineAccessToken: "",
  lineChannelSecret: "",
};

export default function CreateBotModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void; // เรียกเมื่อสร้างสำเร็จ เพื่อให้หน้า list โหลดใหม่
}) {
  const [form, setForm] = useState<Form>(EMPTY);
  const [errs, setErrs] = useState<Errs>({});
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  // ids เพื่อผูก label ↔ input
  const idName = useId();
  const idOpenai = useId();
  const idAccTok = useId();
  const idSecret = useId();

  function update<K extends keyof Form>(k: K, v: string) {
    setForm((s) => ({ ...s, [k]: v }));
    setErrs((e) => ({ ...e, [k]: undefined }));
  }

  function validateAll(f: Form): Errs {
    const e: Errs = {};
    if (!f.name.trim()) e.name = "กรุณาตั้งชื่อบอท";
    if (!f.openaiApiKey?.trim()) e.openaiApiKey = "กรอก OpenAI API Key";
    else if (!/^sk-(proj-)?[A-Za-z0-9_]/.test(f.openaiApiKey.trim()))
      e.openaiApiKey = "ฟอร์แมตไม่ถูกต้อง (ควรขึ้นต้นด้วย sk- หรือ sk-proj-)";
    if (!f.lineAccessToken?.trim()) e.lineAccessToken = "กรอก LINE Channel Access Token";
    else if (f.lineAccessToken.trim().length < 30) e.lineAccessToken = "สั้นเกินไป (≥ 30)";
    if (!f.lineChannelSecret?.trim()) e.lineChannelSecret = "กรอก LINE Channel Secret";
    else if (!/^[A-Za-z0-9]{32}$/.test(f.lineChannelSecret.trim()))
      e.lineChannelSecret = "ควรเป็นตัวอักษร/ตัวเลข 32 ตัว";
    return e;
  }

  async function onCreate() {
    setBanner(null);
    const e = validateAll(form);
    setErrs(e);
    if (Object.values(e).some(Boolean)) {
      setBanner("กรุณาแก้ไขข้อมูลให้ถูกต้องครบทุกช่องก่อนบันทึก");
      return;
    }

    // confirm
    const msg =
      "ยืนยันสร้างบอทใหม่ พร้อมบันทึก Secrets?\n" +
      `• name: ${short(form.name)}\n` +
      `• openaiApiKey: ${short(form.openaiApiKey)}\n` +
      `• lineAccessToken: ${short(form.lineAccessToken)}\n` +
      `• lineChannelSecret: ${short(form.lineChannelSecret)}`;
    if (!globalThis.confirm?.(msg)) return;

    try {
      setSaving(true);
      // 1) สร้างบอทเปล่า
      const bot = await initBot();
      const botId = (bot as any)?.id as string;

      // 2) ตั้งชื่อ (optional) — reuse API meta patch ผ่าน /bots/:id (รองรับในฝั่ง backend แล้ว)
      // ใช้ fetch ตรงเพื่อเลี่ยงการดึง type เพิ่ม
      await fetch(`/api/bots/${botId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name.trim() }),
      }).catch(() => {});

      // 3) บันทึก secrets
      await updateBotSecrets(botId, {
        openaiApiKey: form.openaiApiKey.trim(),
        lineAccessToken: form.lineAccessToken.trim(),
        lineChannelSecret: form.lineChannelSecret.trim(),
      });

      setBanner("สร้างบอทสำเร็จ ✅");
      // clear แล้วปิด modal
      setForm(EMPTY);
      onDone();
      onClose();
    } catch (err: any) {
      setBanner(err?.message || "สร้างบอทไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
      <dialog
        open
        role="dialog"
        aria-modal="true"
        className="w-full max-w-xl rounded-2xl bg-[#1b1c20] border border-neutral-700 p-6"
      >
        <h3 className="text-lg font-medium mb-4">Create Bot</h3>

        {banner && (
          <div className="mb-3 text-sm text-amber-300 bg-amber-900/30 border border-amber-700 rounded px-3 py-2">
            {banner}
          </div>
        )}

        <div className="space-y-4">
          <Labeled id={idName} label="Bot Name" error={errs.name}>
            <input
              id={idName}
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              maxLength={30}
              className={inputCls(!!errs.name)}
              autoComplete="off"
              aria-invalid={!!errs.name}
            />
          </Labeled>

          <Labeled id={idOpenai} label="OpenAI API Key" error={errs.openaiApiKey}>
            <input
              id={idOpenai}
              value={form.openaiApiKey}
              onChange={(e) => update("openaiApiKey", e.target.value)}
              className={inputCls(!!errs.openaiApiKey)}
              autoComplete="off"
              aria-invalid={!!errs.openaiApiKey}
            />
          </Labeled>

          <Labeled id={idAccTok} label="LINE Channel Access Token" error={errs.lineAccessToken}>
            <input
              id={idAccTok}
              value={form.lineAccessToken}
              onChange={(e) => update("lineAccessToken", e.target.value)}
              className={inputCls(!!errs.lineAccessToken)}
              autoComplete="off"
              aria-invalid={!!errs.lineAccessToken}
            />
          </Labeled>

          <Labeled id={idSecret} label="LINE Channel Secret" error={errs.lineChannelSecret}>
            <input
              id={idSecret}
              value={form.lineChannelSecret}
              onChange={(e) => update("lineChannelSecret", e.target.value)}
              className={inputCls(!!errs.lineChannelSecret)}
              autoComplete="off"
              aria-invalid={!!errs.lineChannelSecret}
            />
          </Labeled>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 rounded-lg bg-neutral-700 hover:bg-neutral-600">
            ปิด
          </button>
          <button
            onClick={onCreate}
            disabled={saving}
            className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60"
          >
            {saving ? "กำลังบันทึก…" : "บันทึกและสร้างบอท"}
          </button>
        </div>
      </dialog>
    </div>
  );
}

function Labeled({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={id} className="block">
      <div className="text-sm text-neutral-300 mb-1">{label}</div>
      {children}
      {error && <div className="mt-1 text-xs text-rose-300">{error}</div>}
    </label>
  );
}

function inputCls(invalid: boolean) {
  return [
    "w-full rounded-md bg-neutral-800 border px-3 py-2 outline-none",
    invalid
      ? "border-rose-600 focus:ring-2 focus:ring-rose-500/30"
      : "border-neutral-700 focus:ring-2 focus:ring-white/10",
  ].join(" ");
}

function short(v: string) {
  if (!v) return "(empty)";
  return v.length <= 8 ? v : v.slice(0, 3) + "…" + v.slice(-3);
}
