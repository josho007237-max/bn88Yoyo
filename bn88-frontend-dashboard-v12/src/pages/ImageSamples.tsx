// src/pages/ImageSamples.tsx
import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  getBots,
  type BotItem,
  listImageSamples,
  uploadImageSamples,
  deleteImageSample,
  getImageSampleBlob,
  type ImageSampleItem,
} from "../lib/api";

const DEFAULT_LABELS = [
  "SLIP",
  "ACTIVITY",
  "OTHER",
  "ID_CARD",
  "CHAT_SCREEN",
  "REVIEW",
];

export default function ImageSamplesPage() {
  const [bots, setBots] = useState<BotItem[]>([]);
  const [botId, setBotId] = useState<string>("");
  const [label, setLabel] = useState<string>("SLIP");
  const [labelFilter, setLabelFilter] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [files, setFiles] = useState<File[]>([]);
  const [items, setItems] = useState<ImageSampleItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await getBots();
        setBots(r.items || []);
        if (r.items?.[0]?.id) setBotId(r.items[0].id);
      } catch (e: any) {
        toast.error(e?.message || "โหลด bot ไม่ได้");
      }
    })();
  }, []);

  async function refresh() {
    if (!botId) return;
    try {
      const r = await listImageSamples(botId, labelFilter || undefined);
      setItems(r.items || []);
    } catch (e: any) {
      toast.error(e?.message || "โหลดตัวอย่างไม่สำเร็จ");
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId, labelFilter]);

  const canUpload = useMemo(
    () => botId && label && files.length > 0,
    [botId, label, files]
  );

  async function onUpload() {
    if (!canUpload) return;

    setLoading(true);
    try {
      await uploadImageSamples({
        botId,
        label: label.toUpperCase(),
        note,
        files,
      });
      toast.success("อัปโหลดตัวอย่างสำเร็จ");
      setFiles([]);
      setNote("");
      await refresh();
    } catch (e: any) {
      toast.error(e?.message || "อัปโหลดไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  async function onPreview(id: string) {
    try {
      const blob = await getImageSampleBlob(id);
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setPreviewOpen(true);
    } catch (e: any) {
      toast.error(e?.message || "โหลดรูปตัวอย่างไม่สำเร็จ");
    }
  }

  async function onDelete(id: string) {
    if (!confirm("ลบตัวอย่างนี้? (จะเป็น soft delete)")) return;
    try {
      await deleteImageSample(id);
      toast.success("ลบแล้ว");
      await refresh();
    } catch (e: any) {
      toast.error(e?.message || "ลบไม่สำเร็จ");
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="text-xl font-semibold">
        Image Samples (สอนบอทด้วยรูปตัวอย่าง)
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
          <div className="text-sm opacity-80">เลือก Bot</div>
          <select
            className="w-full rounded-lg bg-black/30 border border-white/10 p-2"
            value={botId}
            onChange={(e) => setBotId(e.target.value)}
          >
            {bots.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.platform})
              </option>
            ))}
          </select>

          <div className="text-sm opacity-80 mt-2">Label</div>
          <div className="flex gap-2">
            <select
              className="flex-1 rounded-lg bg-black/30 border border-white/10 p-2"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            >
              {DEFAULT_LABELS.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
            <input
              className="flex-1 rounded-lg bg-black/30 border border-white/10 p-2"
              placeholder="หรือพิมพ์ label ใหม่"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>

          <div className="text-sm opacity-80 mt-2">Note (optional)</div>
          <input
            className="w-full rounded-lg bg-black/30 border border-white/10 p-2"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="เช่น slip laos bcel / activity day1"
          />

          <div className="text-sm opacity-80 mt-2">
            เลือกรูป (เลือกหลายรูปได้)
          </div>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
          />

          <button
            className="w-full rounded-lg bg-emerald-600/80 hover:bg-emerald-600 p-2 disabled:opacity-40"
            disabled={!canUpload || loading}
            onClick={onUpload}
          >
            {loading ? "Uploading..." : "Upload Samples"}
          </button>
        </div>

        <div className="md:col-span-2 rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="font-semibold">รายการตัวอย่าง</div>
            <div className="flex gap-2">
              <input
                className="rounded-lg bg-black/30 border border-white/10 p-2"
                placeholder="filter label (เช่น SLIP)"
                value={labelFilter}
                onChange={(e) => setLabelFilter(e.target.value.toUpperCase())}
              />
              <button
                className="rounded-lg bg-white/10 hover:bg-white/15 p-2"
                onClick={refresh}
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-left opacity-70">
                <tr>
                  <th className="py-2">Label</th>
                  <th>Note</th>
                  <th>Created</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-t border-white/10">
                    <td className="py-2 font-mono">{it.label}</td>
                    <td className="truncate max-w-[260px]">{it.note || "-"}</td>
                    <td className="opacity-70">
                      {new Date(it.createdAt).toLocaleString()}
                    </td>
                    <td className="text-right space-x-2">
                      <button
                        className="rounded-lg bg-white/10 hover:bg-white/15 px-3 py-1"
                        onClick={() => onPreview(it.id)}
                      >
                        ดูรูป
                      </button>
                      <button
                        className="rounded-lg bg-red-600/70 hover:bg-red-600 px-3 py-1"
                        onClick={() => onDelete(it.id)}
                      >
                        ลบ
                      </button>
                    </td>
                  </tr>
                ))}
                {!items.length && (
                  <tr>
                    <td className="py-6 opacity-60" colSpan={4}>
                      ยังไม่มีตัวอย่าง
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {previewOpen && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center p-4"
          onClick={() => {
            setPreviewOpen(false);
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            setPreviewUrl("");
          }}
        >
          <div className="max-w-[720px] w-full rounded-xl bg-black/80 border border-white/10 p-3">
            <div className="flex justify-between items-center mb-2">
              <div className="font-semibold">Preview</div>
              <button className="rounded-lg bg-white/10 px-3 py-1">
                Close
              </button>
            </div>
            {previewUrl && (
              <img src={previewUrl} className="w-full rounded-lg" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
