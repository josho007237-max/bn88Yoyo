// src/lib/live.ts
/**
 * Realtime (SSE) client for BN9 dashboard
 * Server endpoint (example):  GET  /api/live/:tenant
 */

export type BN9EventType =
  | "stats:update"   // มีการอัปเดตสถิติ (ให้รีโหลด summary/daily)
  | "case:new"       // มีเคสใหม่ (ให้รีโหลด recent)
  | "ping"           // ทดสอบเชื่อมต่อ
  | "unknown";

export type StopFn = () => void;

/**
 * เปิด SSE แล้วเรียก callback ทุกครั้งที่มี event ใหม่
 * @param tenant  เช่น "bn9"
 * @param onEvent (type) => void
 */
export function connectEvents(
  tenant: string,
  onEvent: (type: BN9EventType) => void
): StopFn {
  // ถ้าไม่ได้ตั้งค่า VITE_API_BASE จะ fallback เป็น origin ปัจจุบัน
  const API_BASE = (import.meta as any).env?.VITE_API_BASE || "";

  // ตัวอย่าง backend: app.get("/api/live/:tenant", sseHandler)
  const url = `${API_BASE}/api/live/${encodeURIComponent(tenant)}`;

  const es = new EventSource(url, { withCredentials: false });

  es.onmessage = (ev) => {
    // payload จาก server อาจเป็น { type: "stats:update" } หรือ string ล้วน
    try {
      const data = JSON.parse(ev.data);
      const t = (data?.type || "unknown") as BN9EventType;
      onEvent(t);
    } catch {
      const txt = (ev.data || "").toString();
      const t: BN9EventType =
        txt === "stats:update" || txt === "case:new" || txt === "ping"
          ? (txt as BN9EventType)
          : "unknown";
      onEvent(t);
    }
  };

  es.onerror = () => {
    // ปล่อยให้ fallback polling ทำงานต่อไป
    // ปิดท่อเพื่อเลิก reconnect อัตโนมัติของ EventSource
    try { es.close(); } catch {}
  };

  // คืนฟังก์ชันสำหรับยกเลิก
  return () => {
    try { es.close(); } catch {}
  };
}
