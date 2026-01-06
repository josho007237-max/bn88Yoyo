"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const bot_controller_1 = require("../controllers/bot.controller");
exports.router = (0, express_1.Router)();
exports.router.post('/broadcast', bot_controller_1.sendBroadcast);
exports.router.get('/flex/sample', bot_controller_1.sendFlexSample);
