// src/routes/index.ts
import { Router } from "express";

import healthRouter from "./health";
import authRouter from "./auth";
import botsRouter from "./bots";
import statsRouter from "./stats";
import casesRouter from "./cases";
import devRouter from "./dev";
import adminCasesRouter from "./admin/cases";
import adminMetricsRouter from "./admin/metrics";

import lineWebhookRouter from "./webhooks/line";

// admin chat (สำหรับ Chat Center)
import { chatAdminRouter } from "./admin/chat";

// ✅ เพิ่ม: admin auth router (login)
import adminAuthRouter from "./admin/auth";

// ✅ เพิ่ม: guard ที่ยิง missing_token
import { authGuard } from "../middleware/authGuard";

/**
 * helper: ดึง router จาก module ที่ export ไม่แน่นอน
 */
function pickRouter(mod: any): any {
  if (!mod) return undefined;

  if (typeof mod.default === "function") return mod.default;
  if (typeof mod === "function") return mod;

  if (mod.router && typeof mod.router === "function") return mod.router;
  if (mod.eventsRouter && typeof mod.eventsRouter === "function")
    return mod.eventsRouter;
  if (mod.adminBotsRouter && typeof mod.adminBotsRouter === "function")
    return mod.adminBotsRouter;

  return undefined;
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const eventsModule = require("./events");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const adminBotsModule = require("./admin/bots");

const eventsRouter = pickRouter(eventsModule);
const adminBotsRouter = pickRouter(adminBotsModule);

const router = Router();

/* --------------------------- public / basic API ------------------------- */
// ---- public / basic API ----
router.use("/auth", authRouter);
router.use("/health", healthRouter);

router.use("/bots", botsRouter);
router.use("/stats", statsRouter);
router.use("/cases", casesRouter);
router.use("/dev", devRouter);

// admin login (public)
router.use("/admin/auth", adminAuthRouter);

/* --------------------------------- events --------------------------------- */

if (eventsRouter) router.use("/events", eventsRouter);

/* ------------------------------- webhooks -------------------------------- */

router.use("/webhooks/line", lineWebhookRouter);

/* -------------------------------- admin ---------------------------------- */

// ✅ สำคัญ: /admin/auth/login ต้องไม่โดน guard
router.use("/admin/auth", adminAuthRouter);

// ✅ ส่วน admin อื่น ๆ ค่อยโดน guard
if (adminBotsRouter) router.use("/admin/bots", authGuard, adminBotsRouter);
router.use("/admin/cases", authGuard, adminCasesRouter);
router.use("/admin/chat", authGuard, chatAdminRouter);
router.use("/admin/metrics", authGuard, adminMetricsRouter);

export default router;

