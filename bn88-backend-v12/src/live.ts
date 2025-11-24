// src/live.ts
import type { Request, Response } from "express";

type Conn = {
  res: Response;
  tenant: string;
  id: string;
};

/**
 * เก็บ connection ของแต่ละ client ที่ subscribe SSE
 * key = connection id (tenant:timestamp:random)
 */
const clients = new Map<string, Conn>();

/**
 * GET /api/live/:tenant
 * เปิดช่องทาง SSE ให้ frontend รับ event แบบ realtime
 */
export function sseHandler(req: Request, res: Response) {
  const tenant = (req.params as any).tenant || "bn9";
  const id = `${tenant}:${Date.now()}:${Math.random()
    .toString(36)
    .slice(2)}`;

  // Header สำหรับ SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  // บาง env มี flushHeaders ให้ใช้เพื่อลด latency
  // @ts-ignore
  res.flushHeaders?.();

  // helper ส่ง event
  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // heartbeat กัน connection หลุด (เช่น Cloudflare / proxy ต่าง ๆ)
  const hb = setInterval(() => {
    send("hb", { t: Date.now() });
  }, 25_000);

  // เก็บ connection นี้ไว้ใน memory
  clients.set(id, { res, tenant, id });

  // ถ้า client ปิด connection → ลบออก + เคลียร์ interval
  req.on("close", () => {
    clearInterval(hb);
    clients.delete(id);
  });
}

/**
 * ยิง event ไปให้ทุก client ที่อยู่ tenant เดียวกัน
 * ใช้จากส่วนอื่นของระบบ เช่น ตอนมี case ใหม่, stats อัปเดต, แชทใหม่ ฯลฯ
 *
 * ตัวอย่างใช้:
 *   emit("chat:new", "bn9", { sessionId, message });
 */
export function emit(event: string, tenant: string, data: unknown) {
  for (const { res, tenant: t } of clients.values()) {
    if (t !== tenant) continue;
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}
