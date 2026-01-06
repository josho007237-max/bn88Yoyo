// src/live.ts
import type { Request, Response } from "express";
import { sseHub } from "./lib/sseHub";

/**
 * GET /api/live/:tenant
 * เปิดช่องทาง SSE ให้ frontend รับ event แบบ realtime
 */
export function sseHandler(req: Request, res: Response) {
  const tenant = (req.params as any).tenant || "bn9";

  // ✅ ผูก connection นี้เข้ากับ hub ตัวเดียวกับที่ webhook ใช้ broadcast
  const clientId = sseHub.addClient(tenant, res);

  console.log("[SSE route] addClient", {
    hub: (sseHub as any).__id,
    tenant,
    clientId,
    clients: sseHub.count(tenant),
  });

  // ✅ ไม่ต้องมี clients map / heartbeat / send ในไฟล์นี้แล้ว
  // เพราะ sseHub.addClient ทำให้หมดแล้ว
}

/**
 * ยิง event ไปให้ทุก client ที่อยู่ tenant เดียวกัน
 * (เผื่อมีโค้ดส่วนอื่นเรียก emit() อยู่ จะไม่พัง)
 */
export function emit(event: string, tenant: string, data: unknown) {
  sseHub.broadcast({
    tenant,
    type: event as any,
    data,
  } as any);
}

