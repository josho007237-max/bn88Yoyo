"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postToGroup = exports.groupSummary = void 0;
const lineMessaging_service_1 = require("../services/lineMessaging.service");
const memoryStore_1 = require("../store/memoryStore");
const groupSummary = async (_req, res) => {
    const groups = Array.from(memoryStore_1.store.groups.entries()).map(([id, g]) => ({ id, ...g }));
    res.json({ groups });
};
exports.groupSummary = groupSummary;
const postToGroup = async (req, res) => {
    const { groupId, messages } = req.body;
    await lineMessaging_service_1.LineMessaging.push(groupId, messages);
    res.json({ ok: true });
};
exports.postToGroup = postToGroup;
