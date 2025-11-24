import React, { useEffect, useMemo, useState } from "react";
import { api, type BotSecretsMasked, type BotSecretsPayload } from "@/lib/api";

type Props = {
  botId: string;
  onSaved?: () => void;
};

const mask = "********";

/** ฟอร์มจัดการ Secrets ของบอท (OpenAI + LINE) */
export default function BotSecretsForm({ botId, onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pinging, setPinging] = useState(false);
  const [msg, setMsg] = useState<string>("");

  // state ฟอร์ม
  const [openaiApiKey, setOpenaiApiKey] = useState<string>("");
  const [lineAccessToken, setLineAccessToken] = useState<string>("");
  const [lineChannelSecret, setLineChannelSecret] = useState<string>("");

  // จำค่าเริ่มต้น (เพื่อรู้ว่า field ไหนถูกแก้)
  const initRef = React.useRef<BotSecretsMasked | null>(null);

  // โหลดค่า masked จาก server
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await api.getBotSecrets(botId);
        if (cancelled) return;
        initRef.current = data ?? {};

        setOpenaiApiKey(data?.openaiApiKey ? mask : "");
        setLineAccessToken(data?.lineAccessToken ? mask : "");
        setLineChannelSecret(data?.lineChannelSecret ? mask : "");
      } catch (e: any) {
        setMsg(e?.message || "โหลดข้อมูลล้มเหลว");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [botId]);

  const changedPayload: BotSecretsPayload = useMemo(() => {
    const init = initRef.current ?? {};
    const p: BotSecretsPayload = {};

    // ถ้าค่าเปลี่ยนและไม่ใช่ mask -> ส่งไปอัปเดต
    if (openaiApiKey && openaiApiKey !== mask) p.openaiApiKey = openaiApiKey.trim();
    if (lineAccessToken && lineAccessToken !== mask) p.lineAccessToken = lineAccessToken.trim();
    if (lineChannelSecret && lineChannelSecret !== mask) p.lineChannelSecret = lineChannelSecret.trim();

    // ถ้า field เคยมีค่า (masked) แต่ผู้ใช้ลบจนเป็นค่าว่าง => ไม่ส่งอะไร (จะคงค่าเดิม)
    // ต้องการ “ลบจริง” ให้ฝั่ง backend ทำ endpoint แยก เช่น DELETE /secrets หรือส่ง null แบบระบุเจตนา

    return p;
  }, [openaiApiKey, lineAccessToken, lineChannelSecret]);

  const somethingChanged = useMemo(
    () => Object.keys(changedPayload).length > 0,
    [changedPayload]
  );

  async function handleSave() {
    setMsg("");
    try {
      setSaving(true);
      if (!somethingChanged) {
        setMsg("ไม่มีการเปลี่ยนแปลง");
        return;
      }
      await api.updateBotSecrets(botId, changedPayload);
      setMsg("บันทึกสำเร็จ");

      // รีโหลดค่า masked ใหม่อีกรอบ
      const data = await api.getBotSecrets(botId);
      initRef.current = data ?? {};
      setOpenaiApiKey(data?.openaiApiKey ? mask : "");
      setLineAccessToken(data?.lineAccessToken ? mask : "");
      setLineChannelSecret(data?.lineChannelSecret ? mask : "");

      onSaved?.();
    } catch (e: any) {
      setMsg(e?.response?.data?.message || e?.message || "บันทึกล้มเหลว");
    } finally {
      setSaving(false);
    }
  }

  async function handlePing() {
    setMsg("");
    try {
      setPinging(true);
      const r = await api.devLinePing(botId); // GET /dev/line-ping/:botId
      if (r?.ok && r?.status === 200) {
        setMsg("PING OK (status 200)");
      } else {
        setMsg(`PING FAIL (status ${r?.status ?? "?"})`);
      }
    } catch (e: any) {
      setMsg(e?.response?.data?.message || e?.message || "PING ล้มเหลว");
    } finally {
      setPinging(false);
    }
  }

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="text-sm text-zinc-400">กำลังโหลด secrets…</div>
      ) : (
        <>
          <div>
            <label className="block text-sm text-zinc-300 mb-1">OpenAI API Key</label>
            <input
              type="password"
              className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm outline-none focus:border-zinc-400"
              placeholder="sk-…"
              value={openaiApiKey}
              onChange={(e) => setOpenaiApiKey(e.target.value)}
              autoComplete="off"
            />
            <p className="mt-1 text-xs text-zinc-500">
              ปลอดภัย: ถ้าเห็น {mask} แปลว่ามีค่าอยู่แล้ว — จะไม่เปลี่ยนจนกว่าจะพิมพ์ค่าใหม่แทน
            </p>
          </div>

          <div>
            <label className="block text-sm text-zinc-300 mb-1">LINE Channel Access Token (long-lived)</label>
            <textarea
              className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm outline-none focus:border-zinc-400 min-h-[84px]"
              placeholder="ยาวมาก ๆ จาก LINE Developers"
              value={lineAccessToken}
              onChange={(e) => setLineAccessToken(e.target.value)}
            />
            <p className="mt-1 text-xs text-zinc-500">
              นำมาจาก LINE Developers → Messaging API → Channel access token (long-lived)
            </p>
          </div>

          <div>
            <label className="block text-sm text-zinc-300 mb-1">LINE Channel Secret</label>
            <input
              type="password"
              className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm outline-none focus:border-zinc-400"
              placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              value={lineChannelSecret}
              onChange={(e) => setLineChannelSecret(e.target.value)}
              autoComplete="off"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving || !somethingChanged}
              className={`px-4 py-2 rounded-xl text-sm ${
                saving || !somethingChanged
                  ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                  : "bg-indigo-600 hover:bg-indigo-500 text-white"
              }`}
            >
              {saving ? "กำลังบันทึก…" : "Save changes"}
            </button>

            <button
              onClick={handlePing}
              disabled={pinging}
              className={`px-3 py-2 rounded-xl text-sm ${
                pinging ? "bg-zinc-800 text-zinc-500 cursor-not-allowed" : "bg-emerald-700 hover:bg-emerald-600 text-white"
              }`}
              title="ทดสอบเรียก /dev/line-ping/:botId (200 = token ใช้งานได้)"
            >
              {pinging ? "Pinging…" : "Ping token"}
            </button>

            {somethingChanged && (
              <span className="text-xs text-amber-400">มีการแก้ไข ยังไม่ได้บันทึก</span>
            )}
          </div>

          {!!msg && (
            <div
              className={`text-sm rounded-lg px-3 py-2 ${
                /ok|success|200/i.test(msg)
                  ? "bg-emerald-900/40 text-emerald-300 border border-emerald-700/40"
                  : /fail|401|403|404|error/i.test(msg)
                  ? "bg-rose-900/40 text-rose-300 border border-rose-700/40"
                  : "bg-zinc-800 text-zinc-300 border border-zinc-700/50"
              }`}
            >
              {msg}
            </div>
          )}
        </>
      )}
    </div>
  );
}
ุ