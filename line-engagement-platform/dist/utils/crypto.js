"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hmacSHA256 = void 0;
const crypto_1 = __importDefault(require("crypto"));
const hmacSHA256 = (key, body) => crypto_1.default.createHmac('sha256', key).update(body).digest('base64');
exports.hmacSHA256 = hmacSHA256;
