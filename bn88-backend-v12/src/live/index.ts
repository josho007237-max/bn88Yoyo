// src/live/index.ts
import { sseHub } from "./sseHub";

export { sseHub } from "./sseHub";

export function emit(type: string, tenant: string, data: unknown) {
  sseHub.emit(type, tenant, data);
}
