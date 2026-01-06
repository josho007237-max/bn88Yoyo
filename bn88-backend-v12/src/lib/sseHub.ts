// src/lib/sseHub.ts
import type { Response } from "express";
import { randomUUID } from "node:crypto";

type SseClient = {
  id: string;
  tenant: string;
  res: Response;
  heartbeat?: NodeJS.Timeout;
};

type BaseEvent<TType extends string, TData = any> = {
  tenant: string;
  type: TType;
  data?: TData;
  ts?: number;
};

export type EventPayload =
  | BaseEvent<"hello", { clientId: string }>
  | BaseEvent<"ping", { t: number }>
  | BaseEvent<"case:new", any>
  | BaseEvent<"stats:update", any>
  | BaseEvent<"bot:verified", any>
  | BaseEvent<"chat:message:new", any>
  // ✅ กันอนาคตเพิ่ม event แล้ว TypeScript ไม่บล็อก
  | BaseEvent<string, any>;

class SseHub {
  public readonly __id = randomUUID();

  private clientsByTenant = new Map<string, Map<string, SseClient>>();

  addClient(tenant: string, res: Response) {
    // ✅ กัน route ลืม set header (ใส่ซ้ำไม่เป็นไร)
    try {
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      (res as any).flushHeaders?.();
    } catch {}

    const id = randomUUID();
    const client: SseClient = { id, tenant, res };

    let map = this.clientsByTenant.get(tenant);
    if (!map) {
      map = new Map<string, SseClient>();
      this.clientsByTenant.set(tenant, map);
    }
    map.set(id, client);

    console.log("[SSE] addClient", {
      hub: this.__id,
      tenant,
      id,
      clients: map.size,
    });

    // ส่ง hello ทันที
    this.send(client, {
      tenant,
      type: "hello",
      data: { clientId: id },
      ts: Date.now(),
    });

    // heartbeat กันหลุด/กัน proxy ตัด (comment line)
    client.heartbeat = setInterval(() => {
      try {
        this.write(res as any, `: ping ${Date.now()}\n\n`);
      } catch {}
    }, 15000);

    // cleanup เมื่อปิด connection
    res.on("close", () => {
      this.removeClient(tenant, id);
    });

    return id;
  }

  removeClient(tenant: string, id: string) {
    const map = this.clientsByTenant.get(tenant);
    const client = map?.get(id);
    if (!map || !client) return;

    try {
      if (client.heartbeat) clearInterval(client.heartbeat);
    } catch {}

    map.delete(id);
    if (map.size === 0) this.clientsByTenant.delete(tenant);

    console.log("[SSE] removeClient", {
      hub: this.__id,
      tenant,
      id,
      clients: map.size,
    });
  }

  count(tenant: string) {
    return this.clientsByTenant.get(tenant)?.size ?? 0;
  }

  broadcast(event: EventPayload) {
    const map = this.clientsByTenant.get(event.tenant);
    const n = map?.size ?? 0;

    console.log("[SSE] broadcast", {
      hub: this.__id,
      tenant: event.tenant,
      type: event.type,
      clients: n,
    });

    if (!map || n === 0) return;

    const payload: EventPayload = { ...event, ts: event.ts ?? Date.now() };
    for (const client of map.values()) {
      this.send(client, payload);
    }
  }

  private send(client: SseClient, event: EventPayload) {
    const resAny = client.res as any;
    if (!resAny || typeof resAny.write !== "function") return;

    // ✅ ส่งแบบ default message (ไม่มี "event:")
    const line = `data: ${JSON.stringify(event)}\n\n`;
    this.write(resAny, line);
  }

  private write(resAny: any, text: string) {
    resAny.write(text);
    // ✅ สำคัญมาก ถ้ามี compression/buffer
    resAny.flush?.();
  }
}

// ✅ Global singleton กันกรณี import คนละ path แล้วได้ hub คนละตัว
const g = globalThis as any;
export const sseHub: SseHub =
  g.__BN88_SSE_HUB__ ?? (g.__BN88_SSE_HUB__ = new SseHub());

