// src/routes/live.ts
import { Router } from "express";
import { sseHub } from "../live/sseHub";   // 👈 ต้องเป็น ../live/sseHub
import { randomUUID } from "node:crypto";

export const live = Router();

live.get("/live/:tenant", (req, res) => {
  const { tenant } = req.params;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  (res as any).flushHeaders?.();
  res.write(": connected\n\n");

  const id = randomUUID();
  sseHub.add({ id, tenant, res });

  const ping = setInterval(() => {
    res.write("event: ping\ndata: {}\n\n");
  }, 25000);

  req.on("close", () => {
    clearInterval(ping);
    sseHub.remove(id);
    res.end();
  });
});
