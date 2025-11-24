// src/lib/events.ts

type Handler = (evt: MessageEvent<any>) => void;

export function connectEvents(opts: {
  tenant: string;
  onCaseNew?: (p: any) => void;
  onStatsUpdate?: (p: any) => void;
  onHello?: (p?: any) => void;
  onPing?: (p?: any) => void;
}) {
  const BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

  // ใช้ route เดียวให้ตรงกับ backend: /api/live/tenant?tenant=...
  const liveUrl = BASE
    ? `${BASE}/api/live/tenant?tenant=${encodeURIComponent(opts.tenant)}`
    : `/api/live/tenant?tenant=${encodeURIComponent(opts.tenant)}`;

  // safe JSON parse
  const parse = (e: MessageEvent) => {
    try {
      return JSON.parse(e.data || "{}");
    } catch {
      return {};
    }
  };

  // ผูก event listeners ให้ EventSource 1 ตัว
  const wire = (es: EventSource) => {
    es.addEventListener("hello", ((e) => opts.onHello?.(parse(e))) as Handler);
    es.addEventListener("hb", ((e) => opts.onPing?.(parse(e))) as Handler);
    es.addEventListener("ping", ((e) => opts.onPing?.(parse(e))) as Handler);
    es.addEventListener(
      "case:new",
      ((e) => opts.onCaseNew?.(parse(e))) as Handler
    );
    es.addEventListener(
      "stats:update",
      ((e) => opts.onStatsUpdate?.(parse(e))) as Handler
    );

    // fallback สำหรับ server ที่ยิง message ทั่วไป { event, data }
    es.onmessage = (e) => {
      const d = parse(e) as any;
      switch ((d?.event || "").toLowerCase()) {
        case "hello":
          opts.onHello?.(d);
          break;
        case "hb":
        case "ping":
          opts.onPing?.(d);
          break;
        case "case:new":
          opts.onCaseNew?.(d);
          break;
        case "stats:update":
          opts.onStatsUpdate?.(d);
          break;
      }
    };
  };

  const createSource = () => new EventSource(liveUrl, { withCredentials: false });

  // เปิดสตรีมครั้งแรก
  let es = createSource();
  wire(es);

  // retry/backoff เวลา connection หลุด
  let retryMs = 1000; // 1 วินาทีเริ่มต้น
  let retryTimer: number | undefined;

  es.onerror = () => {
    try {
      es.close();
    } catch {
      /* ignore */
    }

    if (retryTimer) {
      window.clearTimeout(retryTimer);
    }

    retryTimer = window.setTimeout(() => {
      es = createSource();
      wire(es);
    }, retryMs);

    // เพิ่ม backoff สูงสุด ~30s
    retryMs = Math.min(retryMs * 2, 30000);
  };

  const disconnect = () => {
    try {
      es.close();
    } catch {
      /* ignore */
    }
    if (retryTimer) {
      window.clearTimeout(retryTimer);
    }
  };

  // เผื่อ debug หรือใช้งานใน dev tools
  (disconnect as any).__es = es;

  return disconnect;
}

export default connectEvents;
