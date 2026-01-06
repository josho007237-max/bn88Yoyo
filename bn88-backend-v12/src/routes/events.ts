// src/routes/events.ts
import { Router, type Request, type Response } from "express";
import { getRequestId, createRequestLogger } from "../utils/logger";
import { sseHub } from "../lib/sseHub";

const router = Router();
const TENANT_DEFAULT = process.env.TENANT_DEFAULT || "bn9";

// GET /api/events?tenant=bn9
router.get("/", (req: Request, res: Response) => {
  const requestId = getRequestId(req);
  const log = createRequestLogger(requestId);

  try {
    const tenantHeader = req.headers["x-tenant"] as string | undefined;
    const tenantQuery = req.query.tenant as string | undefined;
    const tenant = tenantHeader || tenantQuery || TENANT_DEFAULT;

    // SSE headers
    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    res.write("retry: 10000\n\n");
    (res as any).flushHeaders?.();

    log.info("[SSE] client connected", { tenant, requestId });

    sseHub.addClient(tenant, res);

    // ห้าม res.end
  } catch (err) {
    console.error("[SSE] error while handling /api/events", err);
    if (!res.headersSent) res.status(500).json({ ok: false, message: "sse_error" });
  }
});

export default router;

