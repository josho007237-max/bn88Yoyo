"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const webhook_controller_1 = require("../controllers/webhook.controller");
exports.router = (0, express_1.Router)();
exports.router.post('/line', webhook_controller_1.handleWebhook);
