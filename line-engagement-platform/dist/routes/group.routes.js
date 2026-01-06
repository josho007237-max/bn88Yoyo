"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const group_controller_1 = require("../controllers/group.controller");
exports.router = (0, express_1.Router)();
exports.router.get('/summary', group_controller_1.groupSummary);
exports.router.post('/post', group_controller_1.postToGroup);
