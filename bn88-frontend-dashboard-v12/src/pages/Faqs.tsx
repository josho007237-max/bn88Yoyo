// src/pages/Faqs.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  createFaq,
  deleteFaq,
  getBots,
  listFaqs,
  updateFaq,
  type BotItem,
  type FaqEntry,
} from "../lib/api";

const defaultForm = { question: "", answer: "" };

export default function Faqs() {
  const [bots, setBots] = useState<BotItem[]>([]);
  const [selectedBot, setSelectedBot] = useState<string>("");
  const [items, setItems] = useState<FaqEntry[]>([]);
  const [filters, setFilters] = useState({ q: "" });
  const [pageInfo, setPageInfo] = useState({ page: 1, pages: 1 });
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ ...defaultForm });
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadBots = useCallback(async () => {
    const res = await getBots();
    setBots(res.items || []);
    if (!selectedBot && res.items?.[0]?.id) setSelectedBot(res.items[0].id);
  }, [selectedBot]);

  const loadFaqs = useCallback(
    async (opts?: { keepPage?: boolean }) => {
      setLoading(true);
      try {
        const res = await listFaqs({
          botId: selectedBot || undefined,
          q: filters.q || undefined,
          page: opts?.keepPage ? pageInfo.page : 1,
          limit: 50,
        });
        setItems(res.items || []);
        setPageInfo({ page: res.page || 1, pages: res.pages || 1 });
      } catch (err) {
        console.error(err);
        toast.error("โหลด FAQ ไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    },
    [selectedBot, filters, pageInfo.page]
  );

  useEffect(() => {
    loadBots();
  }, [loadBots]);

  useEffect(() => {
    loadFaqs();
  }, [loadFaqs]);

  const selectedBotName = useMemo(() => {
    const found = bots.find((b) => b.id === selectedBot);
    return found?.name || "ทั้งหมด";
  }, [bots, selectedBot]);

  const handleSubmit = async () => {
    if (!selectedBot) {
      toast.error("กรุณาเลือกบอทก่อน");
      return;
    }
    if (!form.question.trim() || !form.answer.trim()) {
      toast.error("กรอกคำถามและคำตอบให้ครบ");
      return;
    }

    try {
      if (editingId) {
        const updated = await updateFaq(editingId, {
          botId: selectedBot,
          question: form.question.trim(),
          answer: form.answer.trim(),
        });
        setItems((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
        toast.success("อัปเดต FAQ แล้ว");
      } else {
        const created = await createFaq({
          botId: selectedBot,
          question: form.question.trim(),
          answer: form.answer.trim(),
        });
        setItems((prev) => [created, ...prev]);
        toast.success("เพิ่ม FAQ แล้ว");
      }
      setForm({ ...defaultForm });
      setEditingId(null);
    } catch (err) {
      console.error(err);
      toast.error("บันทึก FAQ ไม่สำเร็จ");
    }
  };

  const handleEdit = (item: FaqEntry) => {
    setEditingId(item.id);
    setForm({ question: item.question, answer: item.answer });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("ยืนยันลบ FAQ นี้?")) return;
    try {
      await deleteFaq(id);
      setItems((prev) => prev.filter((f) => f.id !== id));
      toast.success("ลบ FAQ แล้ว");
    } catch (err) {
      console.error(err);
      toast.error("ลบ FAQ ไม่สำเร็จ");
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 space-y-4">
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-neutral-400">เลือกบอท</div>
              <div className="text-lg font-semibold">{selectedBotName}</div>
            </div>
          </div>

          <select
            className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm"
            value={selectedBot}
            onChange={(e) => setSelectedBot(e.target.value)}
          >
            <option value="">ทั้งหมด</option>
            {bots.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.platform})
              </option>
            ))}
          </select>

          <div className="space-y-2 pt-2">
            <label className="text-sm text-neutral-300">ค้นหา</label>
            <input
              type="text"
              placeholder="เช่น ถอนเงินไม่ได้"
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm"
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            />
            <button
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-3 py-2 text-sm font-medium"
              onClick={() => loadFaqs({ keepPage: false })}
            >
              ค้นหา
            </button>
          </div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-neutral-400">
                {editingId ? "แก้ไข FAQ" : "เพิ่ม FAQ ใหม่"}
              </div>
              <div className="text-lg font-semibold">
                {editingId ? "แก้ไขรายการ" : "สร้างรายการ"}
              </div>
            </div>
            {editingId ? (
              <button
                className="text-sm text-indigo-400 hover:text-indigo-300"
                onClick={() => {
                  setEditingId(null);
                  setForm({ ...defaultForm });
                }}
              >
                ยกเลิก
              </button>
            ) : null}
          </div>

          <div className="space-y-2">
            <label className="text-sm text-neutral-300">คำถาม</label>
            <input
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm"
              value={form.question}
              onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
              placeholder="ลูกค้าถามอะไร"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-neutral-300">คำตอบ</label>
            <textarea
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm h-28"
              value={form.answer}
              onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))}
              placeholder="ตอบลูกคอยังไง"
            />
          </div>

          <button
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg px-3 py-2 text-sm font-semibold"
            onClick={handleSubmit}
          >
            {editingId ? "บันทึกการแก้ไข" : "เพิ่ม FAQ"}
          </button>
        </div>
      </div>

      <div className="lg:col-span-2 bg-neutral-900 border border-neutral-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm text-neutral-400">รายการ FAQ</div>
            <div className="text-xl font-semibold">
              {selectedBot ? `ของบอท ${selectedBotName}` : "ทุกบอท"}
            </div>
          </div>
          {loading && <div className="text-xs text-neutral-400">กำลังโหลด...</div>}
        </div>

        {items.length === 0 ? (
          <div className="text-sm text-neutral-400">ยังไม่มี FAQ</div>
        ) : (
          <div className="space-y-3">
            {items.map((faq) => (
              <div
                key={faq.id}
                className="border border-neutral-800 rounded-lg p-3 bg-neutral-800/50"
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-neutral-100">
                      {faq.question}
                    </div>
                    <div className="text-sm text-neutral-300 whitespace-pre-line mt-1">
                      {faq.answer}
                    </div>
                    <div className="text-[11px] text-neutral-500 mt-1">
                      อัปเดตล่าสุด: {new Date(faq.updatedAt || faq.createdAt || "").toLocaleString("th-TH")}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs"
                      onClick={() => handleEdit(faq)}
                    >
                      แก้ไข
                    </button>
                    <button
                      className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-300 hover:bg-red-500/20 text-xs"
                      onClick={() => handleDelete(faq.id)}
                    >
                      ลบ
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
