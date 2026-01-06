// src/live/sseHub.ts
import type { Response } from "express";

export type SseClient = {
  id: string;
  tenant: string;
  res: Response;
};

export class SseHub {
  private clients = new Map<string, SseClient>();

  add(c: SseClient) {
    this.clients.set(c.id, c);
  }

  remove(id: string) {
    const c = this.clients.get(id);
    if (c) {
      try {
        c.res.end();
      } catch {}
      this.clients.delete(id);
    }
  }

  /** ส่ง event ให้ client เฉพาะ tenant หนึ่ง */
  emit(type: string, tenant: string, data: unknown) {
    const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const c of this.clients.values()) {
      if (c.tenant !== tenant) continue;
      try {
        c.res.write(payload);
      } catch {
        this.clients.delete(c.id);
      }
    }
  }

  /** ส่ง event ให้ทุก tenant (ไม่ค่อยได้ใช้ แต่เผื่อไว้) */
  broadcast(type: string, data: unknown) {
    const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const c of this.clients.values()) {
      try {
        c.res.write(payload);
      } catch {
        this.clients.delete(c.id);
      }
    }
  }

  count(tenant?: string) {
    if (!tenant) return this.clients.size;
    let n = 0;
    for (const c of this.clients.values()) {
      if (c.tenant === tenant) n++;
    }
    return n;
  }
}

export const sseHub = new SseHub();

