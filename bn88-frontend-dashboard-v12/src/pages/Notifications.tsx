import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";

import {
  getNotifications,
  markNotificationRead,
  type NotificationItem,
} from "../lib/api";

type FilterStatus = "unread" | "all";

function formatTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function statusButtonClass(active: boolean) {
  return [
    "px-3 py-1.5 rounded-lg text-sm border",
    active
      ? "bg-white/10 border-white/10 text-white"
      : "bg-transparent border-neutral-800 text-neutral-300 hover:bg-white/5",
  ].join(" ");
}

export default function Notifications() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState<FilterStatus>("unread");
  const [loading, setLoading] = useState(false);

  const unreadCount = useMemo(
    () => items.filter((item) => !item.isRead).length,
    [items]
  );

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getNotifications({ status: filter, limit: 100 });
      setItems(data.items ?? []);
    } catch (err: any) {
      toast.error(err?.message || "โหลดการแจ้งเตือนไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const handleMarkRead = useCallback(async (id: string) => {
    try {
      await markNotificationRead(id, true);
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, isRead: true, readAt: new Date().toISOString() }
            : item
        )
      );
    } catch (err: any) {
      toast.error(err?.message || "อัปเดตสถานะไม่สำเร็จ");
    }
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Notifications</h1>
          <p className="text-sm text-neutral-400">
            การแจ้งเตือนเคสสำคัญจากระบบ
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={statusButtonClass(filter === "unread")}
            onClick={() => setFilter("unread")}
          >
            ยังไม่อ่าน{unreadCount ? ` (${unreadCount})` : ""}
          </button>
          <button
            type="button"
            className={statusButtonClass(filter === "all")}
            onClick={() => setFilter("all")}
          >
            ทั้งหมด
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded-lg text-sm border border-neutral-800 text-neutral-300 hover:bg-white/5"
            onClick={loadNotifications}
            disabled={loading}
          >
            {loading ? "กำลังโหลด..." : "รีเฟรช"}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="rounded-xl border border-neutral-800 bg-[#111318] p-6 text-sm text-neutral-400">
            ยังไม่มีการแจ้งเตือนในขณะนี้
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className={`rounded-xl border p-4 transition ${
                item.isRead
                  ? "border-neutral-800 bg-[#111318]"
                  : "border-amber-400/40 bg-[#1a1812]"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm uppercase tracking-wide text-amber-400">
                      {item.kind}
                    </span>
                    {!item.isRead && (
                      <span className="text-xs rounded-full bg-amber-400/20 px-2 py-0.5 text-amber-200">
                        ใหม่
                      </span>
                    )}
                  </div>
                  <h2 className="text-lg font-semibold text-white">
                    {item.title}
                  </h2>
                  {item.body && (
                    <p className="text-sm text-neutral-300 mt-1">
                      {item.body}
                    </p>
                  )}
                </div>
                <div className="text-right text-xs text-neutral-400">
                  <div>สร้าง: {formatTime(item.createdAt)}</div>
                  {item.readAt && <div>อ่าน: {formatTime(item.readAt)}</div>}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                {item.caseId && (
                  <Link
                    to={`/cases/${item.caseId}`}
                    className="text-indigo-400 hover:text-indigo-300"
                  >
                    เปิดเคส
                  </Link>
                )}
                {!item.isRead && (
                  <button
                    type="button"
                    className="text-amber-300 hover:text-amber-200"
                    onClick={() => handleMarkRead(item.id)}
                  >
                    ทำเครื่องหมายว่าอ่านแล้ว
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
