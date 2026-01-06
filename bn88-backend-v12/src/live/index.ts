// src/live/index.ts
import { sseHub } from "../lib/sseHub";

export { sseHub } from "../lib/sseHub";

export function emit(type: string, tenant: string, data: unknown) {
  // ให้ event ออก hub เดียวกับ /api/events
  (sseHub as any).emit(type, tenant, data);
}

