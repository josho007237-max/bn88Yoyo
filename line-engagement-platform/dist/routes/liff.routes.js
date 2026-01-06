"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const liff_controller_1 = require("../controllers/liff.controller");
exports.router = (0, express_1.Router)();
exports.router.get('/info', liff_controller_1.liffInfo);
