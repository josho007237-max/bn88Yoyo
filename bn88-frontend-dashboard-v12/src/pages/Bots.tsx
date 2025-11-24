// src/pages/Bots.tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, type BotItem } from "../lib/api";
import SecretsModal from "../components/SecretsModal";

type Platform = "line" | "telegram" | "facebook";

export default function Bots() {
  const [items, setItems] = useState<BotItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [openSecretsFor, setOpenSecretsFor] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<{ id: string; name?: string } | null>(null);
  const [creating, setCreating] = useState<Platform | null>(null);

  const empty = useMemo(() => !loading && items.length === 0, [loading, items]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await api.bots();
      const list: BotItem[] = Array.isArray((res as any)?.items) ? (res as any).items : [];
      setItems(list);
    } catch (e: any) {
      setErr(e?.message || "โหลดรายการบอทไม่สำเร็จ");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function onInit(platform: Platform) {
    try {
      setCreating(platform);
      await api.createBot(platform);
    } catch (e: any) {
      setErr(e?.message || "สร้างบอทไม่สำเร็จ");
    } finally {
      setCreating(null);
      load();
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function saveName(b: BotItem, name: string) {
    const newName = name.trim().slice(0, 30);
    if (!newName || newName === (b.name || "")) return;
    const prev = items.slice();
    setItems((arr) => arr.map((x) => (x.id === b.id ? { ...x, name: newName } : x)));
    try {
      await api.updateBotMeta(b.id, { name: newName });
    } catch {
      setItems(prev);
      alert("บันทึกชื่อไม่สำเร็จ");
    }
  }

  async function toggleActive(b: BotItem) {
    const next = !b.active;
    const prev = items.slice();
    setItems((arr) => arr.map((x) => (x.id === b.id ? { ...x, active: next } : x)));
    try {
      await api.updateBotMeta(b.id, { active: next });
    } catch {
      setItems(prev);
      alert("เปลี่ยนสถานะไม่สำเร็จ");
    }
  }

  async function doDelete(id: string) {
    try {
      if (typeof (api as any).deleteBot === "function") {
        await (api as any).deleteBot(id);
      }
      setConfirmDel(null);
      load();
    } catch {
      alert("ลบไม่สำเร็จ");
    }
  }

  let tableBody: JSX.Element;
  if (loading) {
    tableBody = (
      <tr>
        <td className="py-6 px-4 text-gray-400" colSpan={5}>
          Loading…
        </td>
      </tr>
    );
  } else if (empty) {
    tableBody = (
      <tr>
        <td className="py-6 px-4 text-gray-500" colSpan={5}>
          ยังไม่มีบอท กดปุ่มสร้างบอทด้านขวาบนเพื่อเริ่มต้น
        </td>
      </tr>
    );
  } else {
    tableBody = (
      <>
        {items.map((b) => (
          <tr key={b.id} className="border-t border-gray-800">
            <td className="py-3 px-4">
              <div className="flex items-center gap-3">
                <input
                  defaultValue={b.name ?? ""}
                  maxLength={30}
                  placeholder="ตั้งชื่อโน้ตของบอท (สูงสุด 30 ตัว)"
                  className="w-[28ch] md:w-[32ch] rounded-md bg-neutral-800 border border-neutral-700 px-3 py-1.5 outline-none focus:ring-2 focus:ring-white/10"
                  onBlur={(e) => saveName(b, e.target.value)}
                />
                <div className="text-xs text-gray-500 truncate max-w-[28ch]">{b.id}</div>
              </div>
            </td>
            <td className="py-3 px-4">
              <span className="inline-flex items-center rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-gray-200">
                {b.platform ?? "—"}
              </span>
            </td>
            <td className="py-3 px-4">{b.tenant ?? "bn9"}</td>
            <td className="py-3 px-4">
              {b.createdAt ? new Date(b.createdAt).toLocaleString() : "—"}
            </td>
            <td className="py-3 px-4">
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => toggleActive(b)}
                  className={`rounded-md px-3 py-1.5 border ${
                    b.active
                      ? "bg-emerald-700 border-emerald-600"
                      : "bg-neutral-800 border-neutral-700"
                  }`}
                  title={b.active ? "กำลังเปิดใช้งาน" : "ปิดอยู่"}
                >
                  {b.active ? "Active" : "Paused"}
                </button>

                {/* ไปหน้า detail ฝั่ง FE */}
                <Link
                  to={`/bots/${encodeURIComponent(b.id)}`}
                  className="rounded-md bg-blue-600 px-3 py-1.5 hover:bg-blue-500"
                >
                  Manage
                </Link>

                {/* เปิด modal ตั้งค่า secrets ฝั่ง FE */}
                <button
                  onClick={() => setOpenSecretsFor(b.id)}
                  className="rounded-md bg-gray-800 px-3 py-1.5 hover:bg-gray-700"
                >
                  Secrets
                </button>

                <button
                  onClick={() => setConfirmDel({ id: b.id, name: b.name ?? undefined })}
                  className="rounded-md bg-rose-700 px-3 py-1.5 hover:bg-rose-600"
                >
                  Delete
                </button>
              </div>
            </td>
          </tr>
        ))}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#111214] text-gray-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Bots</h1>
          <div className="flex flex-col items-end gap-2">
            <button
              onClick={load}
              className="rounded-lg bg-gray-800 px-4 py-2 text-sm hover:bg-gray-700"
            >
              Refresh
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => onInit("line")}
                disabled={!!creating}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-xs hover:bg-emerald-600 disabled:opacity-60"
              >
                {creating === "line" ? "Creating LINE…" : "Create LINE Bot"}
              </button>
              <button
                onClick={() => onInit("telegram")}
                disabled={!!creating}
                className="rounded-lg bg-sky-700 px-4 py-2 text-xs hover:bg-sky-600 disabled:opacity-60"
              >
                {creating === "telegram" ? "Creating TG…" : "Create TELEGRAM Bot"}
              </button>
              <button
                onClick={() => onInit("facebook")}
                disabled={!!creating}
                className="rounded-lg bg-indigo-700 px-4 py-2 text-xs hover:bg-indigo-600 disabled:opacity-60"
              >
                {creating === "facebook" ? "Creating FB…" : "Create FACEBOOK Bot"}
              </button>
            </div>
          </div>
        </div>

        {err && (
          <div className="text-sm text-rose-300 bg-rose-950/40 border border-rose-900 rounded-lg p-3">
            {err}
          </div>
        )}

        <div className="rounded-2xl bg-[#151619] border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#131417] text-gray-400">
              <tr className="text-left">
                <th className="py-3 px-4">Name / ID</th>
                <th className="py-3 px-4 w-28">Platform</th>
                <th className="py-3 px-4 w-28">Tenant</th>
                <th className="py-3 px-4 w-44">Created</th>
                <th className="py-3 px-4 w-56 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>{tableBody}</tbody>
          </table>
        </div>
      </div>

      {openSecretsFor && (
        <SecretsModal
          botId={openSecretsFor}
          onClose={() => setOpenSecretsFor(null)}
          onSaved={() => {
            setOpenSecretsFor(null);
            load();
          }}
        />
      )}

      {confirmDel && (
        <ConfirmInputModal
          title="ยืนยันลบบอท"
          message={`ต้องการลบ “${confirmDel.name || confirmDel.id}” ใช่ไหม? กรุณาพิมพ์อะไรก็ได้เพื่อยืนยัน`}
          confirmText="ลบเลย"
          onCancel={() => setConfirmDel(null)}
          onConfirm={(text) => (text.trim() ? doDelete(confirmDel.id) : undefined)}
        />
      )}
    </div>
  );
}

/* ------------------------------- Modal ยืนยัน ------------------------------- */
function ConfirmInputModal(props: Readonly<{
  title: string;
  message: string;
  confirmText?: string;
  onCancel: () => void;
  onConfirm: (typed: string) => void | Promise<void>;
}>) {
  const { title, message, onCancel, onConfirm, confirmText = "ยืนยัน" } = props;
  const [typed, setTyped] = useState("");

  const canConfirm = typed.trim().length > 0;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <dialog
        open
        aria-modal="true"
        className="w-full max-w-md rounded-2xl bg-[#1b1c20] border border-neutral-700 p-6"
      >
        <h3 className="text-lg font-medium mb-2">{title}</h3>
        <p className="text-sm text-neutral-300 mb-4">{message}</p>
        <input
          autoFocus
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          className="w-full rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2 outline-none focus:ring-2 focus:ring-white/10"
          placeholder="พิมพ์เพื่อยืนยัน…"
          aria-label="ยืนยันการลบ"
        />
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-2 rounded-lg bg-neutral-700 hover:bg-neutral-600"
          >
            ยกเลิก
          </button>
          <button
            onClick={() => canConfirm && onConfirm(typed)}
            disabled={!canConfirm}
            className="px-3 py-2 rounded-lg bg-rose-700 hover:bg-rose-600 disabled:opacity-60"
          >
            {confirmText}
          </button>
        </div>
      </dialog>
    </div>
  );
}
