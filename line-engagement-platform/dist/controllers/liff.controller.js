"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.liffInfo = void 0;
const liff_service_1 = require("../services/liff.service");
const liffInfo = (_req, res) => {
    res.json((0, liff_service_1.getLiffSettings)());
};
exports.liffInfo = liffInfo;
