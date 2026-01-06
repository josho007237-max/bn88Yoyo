"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const analytics_controller_1 = require("../controllers/analytics.controller");
exports.router = (0, express_1.Router)();
exports.router.get('/events', analytics_controller_1.eventsFeed);
