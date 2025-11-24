// src/components/SecretsModal.tsx
import { useEffect, useId, useState } from "react";
import { getBotSecrets, updateBotSecrets } from "../lib/api";

type Form = {
  openaiApiKey: string;
  lineAccessToken: string;
  lineChannelSecret: string;
};
type Errs = Partial<Record<keyof Form, string>>;

const EMPTY: Form = { openaiApiKey: "", lineAccessToken: "", lineChannelSecret: "" };

export default function SecretsModal(props: Readonly<{
  botId: string;
  onClose: () => void;
  onSaved: () => void;
}>) {
  const { botId, onClose, onSaved } = props;

  const [masked, setMasked] = useState<Partial<Form>>({});
  const [form, setForm] = useState<Form>(EMPTY);
  const [errs, setErrs] = useState<Errs>({});
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  // ids สำหรับ label ↔ input
  const idOpenai = useId();
  const idAccTok = useId();
  const idSecret = useId();

  useEffect(() => {
    (async () => {
      try {
        const m = await getBotSecrets(botId);
        setMasked(m ?? {});
        setForm(EMPTY);
        setErrs({});
        setBanner(null);
      } catch (e: any) {
        setBanner(e?.message || "โหลด secrets ไม่สำเร็จ");
      }
    })();
  }, [botId]);

  function update<K extends keyof Form>(k: K, v: string) {
    setForm((s) => ({ ...s, [k]: v }));
    setErrs((e) => ({ ...e, [k]: undefined }));
  }

  function validateAll(f: Form): Errs {
    const e: Errs = {};
    // OpenAI Key: ขึ้นต้น sk- หรือ sk-proj-
    if (!f.openaiApiKey?.trim()) e.openaiApiKey = "กรอก OpenAI API Key";
    else if (!/^sk-(proj-)?[A-Za-z0-9_-]/.test(f.openaiApiKey.trim()))
      e.openaiApiKey = "ฟอร์แมตไม่ถูกต้อง (ควรขึ้นต้นด้วย sk- หรือ sk-proj-)";

    // LINE Access Token: อย่างน้อย ~30 ตัว
    if (!f.lineAccessToken?.trim()) e.lineAccessToken = "กรอก LINE Channel Access Token";
    else if (f.lineAccessToken.trim().length < 30)
      e.lineAccessToken = "สั้นเกินไป (ควรยาว ≥ 30 ตัวอักษร)";

    // LINE Channel Secret: 32 ตัวอักษร/ตัวเลข
    if (!f.lineChannelSecret?.trim()) e.lineChannelSecret = "กรอก LINE Channel Secret";
    else if (!/^[A-Za-z0-9]{32}$/.test(f.lineChannelSecret.trim()))
      e.lineChannelSecret = "ควรเป็นตัวอักษร/ตัวเลข 32 ตัว";
    return e;
  }

  async function onSave() {
    setBanner(null);
    const e = validateAll(form);
    setErrs(e);
    if (Object.values(e).some(Boolean)) {
      setBanner("กรุณาแก้ไขข้อมูลให้ถูกต้องครบทั้ง 3 ช่องก่อนบันทึก");
      return;
    }

    const ok = (globalThis.confirm?.(
      "ยืนยันบันทึกค่าเหล่านี้?\n" +
        `• openaiApiKey: ${short(form.openaiApiKey)}\n` +
        `• lineAccessToken: ${short(form.lineAccessToken)}\n` +
        `• lineChannelSecret: ${short(form.lineChannelSecret)}`
    ) ?? true);
    if (!ok) return;

    try {
      setSaving(true);
      await updateBotSecrets(botId, {
        openaiApiKey: form.openaiApiKey.trim(),
        lineAccessToken: form.lineAccessToken.trim(),
        lineChannelSecret: form.lineChannelSecret.trim(),
      });
      setBanner("บันทึกสำเร็จ ✅");
      const ref = await getBotSecrets(botId);
      setMasked(ref ?? {});
      setForm(EMPTY);
      setErrs({});
      onSaved();
    } catch (e: any) {
      setBanner(e?.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      {/* ใช้ <dialog open aria-modal> — ไม่ต้องใส่ role="dialog" ซ้ำ */}
      <dialog
        open
        aria-modal="true"
        className="w-full max-w-xl rounded-2xl bg-[#1b1c20] border border-neutral-700 p-6"
      >
        <h3 className="text-lg font-medium mb-4">Secrets</h3>

        {banner && (
          <div className="mb-3 text-sm text-amber-300 bg-amber-900/30 border border-amber-700 rounded px-3 py-2">
            {banner}
          </div>
        )}

        <div className="space-y-4">
          <Field id={idOpenai} label="OpenAI API Key" error={errs.openaiApiKey}>
            <input
              id={idOpenai}
              className={inputCls(!!errs.openaiApiKey)}
              placeholder={masked.openaiApiKey ? "******** (พิมพ์ใหม่เพื่อแทนที่เดิม)" : ""}
              value={form.openaiApiKey}
              onChange={(e) => update("openaiApiKey", e.target.value)}
              autoComplete="off"
              aria-invalid={!!errs.openaiApiKey}
            />
          </Field>

          <Field id={idAccTok} label="LINE Channel Access Token" error={errs.lineAccessToken}>
            <textarea
              id={idAccTok}
              rows={3}
              className={inputCls(!!errs.lineAccessToken)}
              placeholder={masked.lineAccessToken ? "******** (พิมพ์ใหม่เพื่อแทนที่เดิม)" : ""}
              value={form.lineAccessToken}
              onChange={(e) => update("lineAccessToken", e.target.value)}
              autoComplete="off"
              aria-invalid={!!errs.lineAccessToken}
            />
          </Field>

          <Field id={idSecret} label="LINE Channel Secret" error={errs.lineChannelSecret}>
            <input
              id={idSecret}
              className={inputCls(!!errs.lineChannelSecret)}
              placeholder={masked.lineChannelSecret ? "******** (พิมพ์ใหม่เพื่อแทนที่เดิม)" : ""}
              value={form.lineChannelSecret}
              onChange={(e) => update("lineChannelSecret", e.target.value)}
              autoComplete="off"
              aria-invalid={!!errs.lineChannelSecret}
            />
          </Field>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 rounded-lg bg-neutral-700 hover:bg-neutral-600">
            ปิด
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60"
          >
            {saving ? "กำลังบันทึก…" : "บันทึก"}
          </button>
        </div>
      </dialog>
    </div>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: Readonly<{
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}>) {
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
