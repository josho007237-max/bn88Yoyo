// src/pages/CaseDetail.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  CaseAttachment,
  CaseItem,
  CaseStatus,
  fetchLineContentObjectUrl,
  getAdminCase,
  getToken,
  updateAdminCase,
  withToken,
} from "../lib/api";
import { subscribeTenantEvents } from "../lib/events";

const TENANT = import.meta.env.VITE_TENANT || "bn9";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  REVIEW: "Review",
  RESOLVED: "Resolved",
};

function StatusBadge({ status }: { status?: CaseStatus }) {
  if (!status) return null;
  const colors: Record<CaseStatus, string> = {
    PENDING: "bg-amber-500/10 text-amber-200 border-amber-400/40",
    REVIEW: "bg-blue-500/10 text-blue-200 border-blue-400/40",
    RESOLVED: "bg-emerald-500/10 text-emerald-200 border-emerald-400/40",
    APPROVED: "bg-emerald-500/10 text-emerald-200 border-emerald-400/40",
    REJECTED: "bg-red-500/10 text-red-200 border-red-400/40",
    NEED_MORE_INFO: "bg-amber-500/10 text-amber-200 border-amber-400/40",
  };
  const label = STATUS_LABEL[status] || status;
  const cls = colors[status] || "bg-neutral-700 text-white border-neutral-500";
  return (
    <span className={`px-2 py-1 rounded-full text-[11px] border ${cls}`}>
      {label}
    </span>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function parseAdminFromToken(): { id?: string; email?: string } | null {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1] || ""));
    return { id: payload?.sub ?? payload?.id, email: payload?.email };
  } catch {
    return null;
  }
}

function AttachmentPreview({ attachment }: { attachment: CaseAttachment }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let revoke: (() => void) | null = null;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        if (attachment.lineContentId) {
          const res = await fetchLineContentObjectUrl(attachment.lineContentId);
          setUrl(res.url);
          revoke = res.revoke;
        } else {
          setUrl(withToken(attachment.url));
        }
      } catch (err: any) {
        console.error(err);
        setError("โหลดรูปไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    };
    load();
    return () => {
      if (revoke) revoke();
    };
  }, [attachment.lineContentId, attachment.url]);

  if (error) return <div className="text-sm text-red-400">{error}</div>;
  if (loading) return <div className="text-sm text-neutral-400">กำลังโหลดรูป...</div>;
  if (!url) return null;

  return (
    <div className="rounded-lg border border-neutral-800 overflow-hidden bg-neutral-900">
      <img src={url} alt="case-attachment" className="w-full max-h-80 object-contain" />
      <div className="flex items-center justify-between px-3 py-2 text-xs text-neutral-400">
        <span>{attachment.source || ""}</span>
        <a
          className="text-indigo-300 hover:underline"
          href={withToken(attachment.url)}
          target="_blank"
          rel="noreferrer"
        >
          เปิดต้นฉบับ
        </a>
      </div>
    </div>
  );
}

export default function CaseDetail() {
  const params = useParams();
  const caseId = params.caseId || params.id;

  const [item, setItem] = useState<CaseItem | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const me = useMemo(() => parseAdminFromToken(), []);

  const load = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getAdminCase(caseId);
      setItem(res.item);
      setNotes(res.item.reviewNotes ?? "");
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "โหลดข้อมูลเคสไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!caseId) return;
    const unsub = subscribeTenantEvents(TENANT, {
      onEvent: (eventName, payload) => {
        const ev = String(eventName || "").toLowerCase();
        const payloadId = (payload as any)?.case?.id ?? (payload as any)?.id;
        if (payloadId === caseId && (ev === "case:update" || ev === "case:new")) {
          load();
        }
      },
    });
    return () => unsub();
  }, [caseId, load]);

  const updateCase = useCallback(
    async (payload: Partial<Pick<CaseItem, "status">> & { assigneeId?: string | null }) => {
      if (!caseId) return;
      setSaving(true);
      try {
        const res = await updateAdminCase(caseId, { ...payload, reviewNotes: notes });
        setItem(res.item);
        setNotes(res.item.reviewNotes ?? "");
        toast.success("บันทึกเคสแล้ว");
      } catch (err: any) {
        console.error(err);
        toast.error(err?.message || "อัปเดตเคสไม่สำเร็จ");
      } finally {
        setSaving(false);
      }
    },
    [caseId, notes]
  );

  const saveNotes = useCallback(() => updateCase({}), [updateCase]);

  const assignToMe = useCallback(() => {
    if (!me?.id) {
      toast.error("หา admin id ไม่ได้จาก token");
      return;
    }
    updateCase({ assigneeId: me.id });
  }, [me?.id, updateCase]);

  const clearAssignee = useCallback(() => updateCase({ assigneeId: null }), [updateCase]);

  if (loading) return <div className="text-neutral-300">กำลังโหลด...</div>;
  if (error) return <div className="text-red-400">{error}</div>;
  if (!item) return <div className="text-neutral-300">ไม่พบเคส</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="text-xs text-neutral-500">Case ID: {item.id}</div>
          <h1 className="text-xl font-semibold text-neutral-100">{item.kind || "Case"}</h1>
          <div className="flex items-center gap-2 text-sm text-neutral-300">
            <StatusBadge status={item.status} />
            <span className="text-neutral-500">User:</span>
            <span>{item.userId || "-"}</span>
            {item.session?.displayName && (
              <span className="text-neutral-500">({item.session.displayName})</span>
            )}
          </div>
          <div className="text-xs text-neutral-500">
            Bot: {item.bot?.name || item.botId} · Platform: {item.platform || item.session?.platform || "-"}
          </div>
          <div className="text-xs text-neutral-500">สร้างเมื่อ {formatDate(item.createdAt)}</div>
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-200">
          <Link
            to="/cases"
            className="rounded-lg border border-neutral-700 px-3 py-1.5 hover:bg-neutral-800"
          >
            กลับรายการ
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-4">
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 space-y-2">
            <div className="text-sm font-semibold text-neutral-100">ข้อความ</div>
            <div className="whitespace-pre-line text-sm text-neutral-200">{item.text || "-"}</div>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-neutral-100">บันทึก / Note</div>
              <button
                onClick={saveNotes}
                disabled={saving}
                className="text-xs rounded-lg border border-indigo-600 px-3 py-1 text-indigo-100 hover:bg-indigo-600/20 disabled:opacity-50"
              >
                บันทึกโน้ต
              </button>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
              placeholder="ใส่รายละเอียดการตรวจสอบ"
            />
          </div>

          {item.attachments && item.attachments.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-neutral-100">รูป / ไฟล์</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {item.attachments.map((att, idx) => (
                  <AttachmentPreview key={`${att.url}-${idx}`} attachment={att} />
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
            <div className="text-sm font-semibold text-neutral-100 mb-2">Meta</div>
            <pre className="text-xs text-neutral-300 whitespace-pre-wrap break-all">
              {JSON.stringify(item.meta ?? {}, null, 2)}
            </pre>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 space-y-2">
            <div className="text-sm font-semibold text-neutral-100">สถานะ</div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => updateCase({ status: "PENDING" })}
                disabled={saving}
                className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-800 disabled:opacity-50"
              >
                กลับเป็น Pending
              </button>
              <button
                onClick={() => updateCase({ status: "REVIEW" })}
                disabled={saving}
                className="rounded-lg border border-blue-500/60 px-3 py-1.5 text-sm text-blue-100 hover:bg-blue-500/10 disabled:opacity-50"
              >
                Mark Review
              </button>
              <button
                onClick={() => updateCase({ status: "RESOLVED" })}
                disabled={saving}
                className="rounded-lg border border-emerald-500/60 px-3 py-1.5 text-sm text-emerald-100 hover:bg-emerald-500/10 disabled:opacity-50"
              >
                Resolve
              </button>
            </div>
            <div className="text-xs text-neutral-400 space-y-1">
              <div>Resolved At: {formatDate(item.resolvedAt)}</div>
              <div>Assignee: {item.assignee?.email || item.assigneeId || "-"}</div>
              <div>Resolved By: {item.resolvedBy || "-"}</div>
            </div>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 space-y-2">
            <div className="text-sm font-semibold text-neutral-100">ผู้รับผิดชอบ</div>
            <div className="text-sm text-neutral-200">
              ปัจจุบัน: {item.assignee?.email || item.assigneeId || "ยังไม่มอบหมาย"}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={assignToMe}
                disabled={saving}
                className="rounded-lg border border-indigo-500/60 px-3 py-1.5 text-sm text-indigo-100 hover:bg-indigo-500/10 disabled:opacity-50"
              >
                Assign to me{me?.email ? ` (${me.email})` : ""}
              </button>
              <button
                onClick={clearAssignee}
                disabled={saving}
                className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-800 disabled:opacity-50"
              >
                ล้างการมอบหมาย
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
