"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const error_1 = require("./middleware/error");
const basicAuth_1 = require("./middleware/basicAuth");
const message_queue_1 = require("./queues/message.queue");
const express_2 = require("@bull-board/express");
const bullMQAdapter_1 = require("@bull-board/api/bullMQAdapter");
const api_1 = require("@bull-board/api");
const createApp = () => {
    const app = (0, express_1.default)();
    // 기본 미들웨어
    app.use((0, cors_1.default)());
    app.use(express_1.default.json());
    // Health check
    app.get("/health", (_req, res) => {
        res.json({ ok: true, service: "line-engagement-platform" });
    });
    // TODO: ภายหลังค่อยมาใช้ router จริง ๆ
    // ตัวอย่าง (ยังไม่บังคับใช้):
    // const webhookRoutes = require("./routes/webhook.routes") as any;
    // app.use("/webhook/line", webhookRoutes.router ?? webhookRoutes.default ?? webhookRoutes);
    /* ------------------------------------------------------------------ */
    /* Bull Board                                                          */
    /* ------------------------------------------------------------------ */
    const serverAdapter = new express_2.ExpressAdapter();
    serverAdapter.setBasePath("/admin/queues");
    (0, api_1.createBullBoard)({
        // cast เป็น any เพื่อกัน TypeScript งอแงเรื่อง type ของ Job
        queues: [new bullMQAdapter_1.BullMQAdapter(message_queue_1.messageQueue)],
        serverAdapter,
    });
    app.use("/admin/queues", basicAuth_1.basicAuthMiddleware, serverAdapter.getRouter());
    /* ------------------------------------------------------------------ */
    /* Error handler                                                       */
    /* ------------------------------------------------------------------ */
    app.use(error_1.errorHandler);
    return app;
};
exports.createApp = createApp;
