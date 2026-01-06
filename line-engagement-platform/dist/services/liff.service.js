"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLiffSettings = void 0;
const env_1 = require("../config/env");
const getLiffSettings = () => ({
    liffId: env_1.env.LIFF_APP_ID,
    appUrl: '/liff-app/index.html',
});
exports.getLiffSettings = getLiffSettings;
