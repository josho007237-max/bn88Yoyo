// src/pages/Cases.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  CaseItem,
  CaseStatus,
  listAdminCases,
} from "../lib/api";
import { subscribeTenantEvents } from "../lib/events";

const TENANT = import.meta.env.VITE_TENANT || "bn9";
const PAGE_SIZE = 20;

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

export default function Cases() {
  const [items, setItems] = useState<CaseItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ status: "", kind: "", q: "" });

  const pages = useMemo(
    () => (total > 0 ? Math.ceil(total / PAGE_SIZE) : 1),
    [total]
  );

  const load = useCallback(
    async (nextPage?: number) => {
      const targetPage = nextPage ?? page;
      setLoading(true);
      try {
        const res = await listAdminCases({
          ...filters,
          page: targetPage,
          pageSize: PAGE_SIZE,
        });
        setItems(res.items ?? []);
        setTotal(res.total ?? 0);
        setPage(res.page ?? targetPage);
      } catch (err: any) {
        console.error(err);
        toast.error(err?.message || "โหลดรายการเคสไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    },
    [filters, page]
  );

  useEffect(() => {
    setPage(1);
    load(1);
  }, [filters, load]);

  useEffect(() => {
    const unsubscribe = subscribeTenantEvents(TENANT, {
      onEvent: (eventName) => {
        const ev = String(eventName || "").toLowerCase();
        if (ev === "case:new") {
          setPage(1);
          load(1);
        } else if (ev === "case:update") {
          load();
        }
      },
    });
    return () => unsubscribe();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Cases</h1>
          <p className="text-sm text-neutral-400">ติดตามเคส PENDING/REVIEW/RESOLVED</p>
        </div>
        <button
          onClick={() => load(1)}
          className="px-3 py-1.5 rounded-lg border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-sm"
        >
          รีเฟรช
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-400">Status</label>
          <select
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm"
          >
            <option value="">ทั้งหมด</option>
            <option value="PENDING">Pending</option>
            <option value="REVIEW">Review</option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-400">Kind</label>
          <input
            value={filters.kind}
            onChange={(e) => setFilters((f) => ({ ...f, kind: e.target.value }))}
            className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm"
            placeholder="deposit / withdraw / activity"
          />
        </div>
        <div className="md:col-span-2 flex flex-col gap-1">
          <label className="text-xs text-neutral-400">ค้นหา</label>
          <input
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm"
            placeholder="ข้อความ, userId, note"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-neutral-800">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-900/60 text-neutral-400 uppercase text-[11px]">
            <tr>
              <th className="px-3 py-2 text-left">Created</th>
              <th className="px-3 py-2 text-left">User</th>
              <th className="px-3 py-2 text-left">Kind</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Text</th>
              <th className="px-3 py-2 text-left">Bot / Platform</th>
              <th className="px-3 py-2 text-left">Assignee</th>
              <th className="px-3 py-2 text-left"></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-center text-neutral-400" colSpan={8}>
                  {loading ? "กำลังโหลด..." : "ยังไม่มีเคส"}
                </td>
              </tr>
            ) : (
              items.map((c) => (
                <tr key={c.id} className="border-t border-neutral-800 hover:bg-neutral-900/60">
                  <td className="px-3 py-3 whitespace-nowrap text-xs text-neutral-300">
                    {formatDate(c.createdAt)}
                  </td>
                  <td className="px-3 py-3 text-xs">
                    <div className="font-medium text-neutral-100">{c.userId || "-"}</div>
                    <div className="text-[11px] text-neutral-500">{c.session?.displayName || ""}</div>
                  </td>
                  <td className="px-3 py-3 text-xs text-neutral-200">{c.kind || "-"}</td>
                  <td className="px-3 py-3 text-xs">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-3 py-3 text-xs text-neutral-100">
                    <div className="line-clamp-2 whitespace-pre-line">{c.text || "-"}</div>
                  </td>
                  <td className="px-3 py-3 text-xs text-neutral-300">
                    <div>{c.bot?.name || c.botId}</div>
                    <div className="text-[11px] text-neutral-500">{c.platform || c.session?.platform || ""}</div>
                  </td>
                  <td className="px-3 py-3 text-xs text-neutral-200">
                    {c.assignee?.email || c.assigneeId || "-"}
                  </td>
                  <td className="px-3 py-3 text-right text-xs">
                    <Link
                      to={`/cases/${c.id}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-neutral-700 px-3 py-1.5 text-neutral-100 hover:bg-neutral-800"
                    >
                      เปิดดู
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-neutral-300">
        <div>
          {(() => {
            const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
            const to = total === 0 ? 0 : Math.min(page * PAGE_SIZE, total);
            return `แสดง ${from} - ${to} จาก ${total} รายการ`;
          })()}
        </div>
        <div className="flex items-center gap-2">
          <button
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border border-neutral-700 px-3 py-1.5 disabled:opacity-50"
          >
            Prev
          </button>
          <span className="text-xs text-neutral-400">
            Page {page} / {pages}
          </span>
          <button
            disabled={page >= pages || loading}
            onClick={() => setPage((p) => Math.min(p + 1, pages))}
            className="rounded-lg border border-neutral-700 px-3 py-1.5 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
