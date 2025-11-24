// src/components/BotIntentsPanel.tsx
import React, { useEffect, useState } from "react";
import {
  getBotIntents,
  createBotIntent,
  updateBotIntent,
  deleteBotIntent,
  type BotIntent,
} from "../lib/api";

type Props = {
  botId: string;
};

type IntentForm = {
  id?: string | null;
  code: string;
  title: string;
  keywords: string; // แสดง/แก้ไขเป็น comma-separated
  fallback: string;
};

const EMPTY_FORM: IntentForm = {
  id: null,
  code: "",
  title: "",
  keywords: "",
  fallback: "",
};

const SUGGESTED_CODES = ["deposit", "withdraw", "register", "kyc", "other"];

const BotIntentsPanel: React.FC<Props> = ({ botId }) => {
  const [items, setItems] = useState<BotIntent[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<IntentForm>(EMPTY_FORM);

  useEffect(() => {
    if (!botId) return;
    load();
  }, [botId]);

  async function load() {
    try {
      setLoading(true);
      const list = await getBotIntents(botId);
      setItems(list);
    } catch (err) {
      console.error("load intents error:", err);
      alert("โหลด Bot Intents ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setForm(EMPTY_FORM);
  }

  function onEditClick(it: BotIntent) {
    setForm({
      id: it.id,
      code: it.code,
      title: it.title,
      keywords: (it.keywords || []).join(", "),
      fallback: it.fallback || "",
    });
  }

  function onChange<K extends keyof IntentForm>(k: K, v: string) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.code.trim()) {
      alert("กรุณากรอก code ของ intent");
      return;
    }
    if (!form.title.trim()) {
      alert("กรุณากรอกชื่อ intent (title)");
      return;
    }

    const payload = {
      code: form.code.trim(),
      title: form.title.trim(),
      keywords: form.keywords
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      fallback: form.fallback.trim() || null,
    };

    try {
      setSaving(true);
      let saved: BotIntent;

      if (form.id) {
        // update
        saved = await updateBotIntent(botId, form.id, payload);
      } else {
        // create
        saved = await createBotIntent(botId, payload);
      }

      // อัปเดตรายการใน state
      setItems((prev) => {
        const idx = prev.findIndex((x) => x.id === saved.id);
        if (idx === -1) return [saved, ...prev];
        const copy = [...prev];
        copy[idx] = saved;
        return copy;
      });

      resetForm();
      alert("บันทึก Intent สำเร็จ ✔");
    } catch (err) {
      console.error("save intent error:", err);
      alert("บันทึก Intent ไม่สำเร็จ ❌");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("ต้องการลบ Intent นี้จริงหรือไม่?")) return;

    try {
      setDeletingId(id);
      await deleteBotIntent(botId, id);
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch (err) {
      console.error("delete intent error:", err);
      alert("ลบ Intent ไม่สำเร็จ ❌");
    } finally {
      setDeletingId(null);
    }
  }

  function applyCode(code: string) {
    setForm((s) => ({ ...s, code }));
  }

  return (
    <div className="mt-6 rounded-2xl bg-[#151619] border border-gray-800 p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm text-neutral-100">Intents / หมวดเคสของบอท</div>
          <div className="text-xs text-neutral-400">
            ใช้กำหนดหมวด เช่น deposit / withdraw / register / kyc / other
            และกำหนด keyword ที่จะทำให้ข้อความจัดเข้า intent นั้น
          </div>
        </div>
        <button
          type="button"
          onClick={resetForm}
          className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs"
        >
          เคลียร์ฟอร์ม
        </button>
      </div>

      {/* Suggested codes */}
      <div className="flex flex-wrap gap-2 text-xs text-neutral-300">
        <span className="text-neutral-500">ตัวอย่าง code:</span>
        {SUGGESTED_CODES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => applyCode(c)}
            className="px-2 py-1 rounded-full bg-neutral-800 hover:bg-neutral-700 border border-neutral-700"
          >
            {c}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="border border-neutral-800 rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-black/30 text-neutral-400">
            <tr>
              <th className="px-3 py-2 text-left w-[90px]">Code</th>
              <th className="px-3 py-2 text-left w-[160px]">Title</th>
              <th className="px-3 py-2 text-left">Keywords</th>
              <th className="px-3 py-2 text-left w-[220px]">Fallback</th>
              <th className="px-3 py-2 text-right w-[80px]">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-3 text-center text-neutral-500"
                >
                  Loading…
                </td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-3 text-center text-neutral-500"
                >
                  ยังไม่มี intents สำหรับบอทนี้
                </td>
              </tr>
            )}
            {!loading &&
              items.map((it) => (
                <tr
                  key={it.id}
                  className="border-t border-neutral-800 hover:bg-white/5"
                >
                  <td className="px-3 py-2 font-mono text-[11px]">
                    {it.code}
                  </td>
                  <td className="px-3 py-2">{it.title}</td>
                  <td className="px-3 py-2 text-neutral-300">
                    {(it.keywords || []).join(", ")}
                  </td>
                  <td className="px-3 py-2 text-neutral-300">
                    {it.fallback || "-"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex gap-2">
                      <button
                        type="button"
                        onClick={() => onEditClick(it)}
                        className="px-2 py-1 rounded-lg bg-sky-700 hover:bg-sky-600 text-[11px]"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(it.id)}
                        disabled={deletingId === it.id}
                        className="px-2 py-1 rounded-lg bg-red-700 hover:bg-red-600 text-[11px] disabled:opacity-60"
                      >
                        {deletingId === it.id ? "..." : "Del"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Form */}
      <form onSubmit={onSubmit} className="space-y-3 pt-2 border-t border-neutral-800">
        <div className="text-xs text-neutral-400">
          {form.id ? "แก้ไข Intent ที่เลือก" : "เพิ่ม Intent ใหม่"}
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          <Field label="Code (เช่น deposit / withdraw / register / kyc / other)">
            <input
              className="w-full px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700 outline-none focus:ring-2 focus:ring-white/10 text-sm"
              value={form.code}
              onChange={(e) => onChange("code", e.target.value)}
              spellCheck={false}
            />
          </Field>

          <Field label="Title แสดงในระบบ">
            <input
              className="w-full px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700 outline-none focus:ring-2 focus:ring-white/10 text-sm"
              value={form.title}
              onChange={(e) => onChange("title", e.target.value)}
              spellCheck={false}
            />
          </Field>

          <Field label="Keywords (คั่นด้วย ,)">
            <input
              className="w-full px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700 outline-none focus:ring-2 focus:ring-white/10 text-sm"
              placeholder="เช่น ฝาก, เติม, เครดิตไม่เข้า"
              value={form.keywords}
              onChange={(e) => onChange("keywords", e.target.value)}
              spellCheck={false}
            />
          </Field>
        </div>

        <Field label="Fallback message (ถ้าบอทไม่มี AI หรือ AI error)">
          <textarea
            rows={3}
            className="w-full px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700 outline-none focus:ring-2 focus:ring-white/10 text-sm"
            placeholder="ข้อความตอบกลับกรณีใช้ fallback ของ intent นี้"
            value={form.fallback}
            onChange={(e) => onChange("fallback", e.target.value)}
          />
        </Field>

        <div className="flex justify-end gap-2">
          {form.id && (
            <button
              type="button"
              onClick={resetForm}
              className="px-3 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm"
            >
              ยกเลิกแก้ไข
            </button>
          )}
          <button
            type="submit"
            disabled={saving}
            className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm disabled:opacity-60"
          >
            {saving
              ? "กำลังบันทึก…"
              : form.id
              ? "Save changes"
              : "Add Intent"}
          </button>
        </div>
      </form>
    </div>
  );
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-neutral-300">{label}</span>
      {children}
    </label>
  );
}

export default BotIntentsPanel;
