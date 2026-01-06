"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const payments_controller_1 = require("../controllers/payments.controller");
exports.router = (0, express_1.Router)();
exports.router.post('/create', payments_controller_1.createPayment);
exports.router.post('/confirm', payments_controller_1.confirm);
