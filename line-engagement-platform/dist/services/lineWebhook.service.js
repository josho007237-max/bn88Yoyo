"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifySignature = void 0;
const env_1 = require("../config/env");
const crypto_1 = require("../utils/crypto");
const verifySignature = (bodyRaw, signature) => {
    const expected = (0, crypto_1.hmacSHA256)(env_1.env.LINE_CHANNEL_SECRET, bodyRaw);
    return signature === expected;
};
exports.verifySignature = verifySignature;
