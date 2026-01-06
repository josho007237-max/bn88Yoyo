"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.confirmPayment = exports.requestPayment = void 0;
const axios_1 = require("../utils/axios");
const env_1 = require("../config/env");
const crypto_1 = __importDefault(require("crypto"));
const headers = (uri, body) => {
    const nonce = crypto_1.default.randomBytes(16).toString('hex');
    const bodyStr = JSON.stringify(body);
    const signature = crypto_1.default
        .createHmac('sha256', env_1.env.PAY.CHANNEL_SECRET)
        .update(env_1.env.PAY.CHANNEL_SECRET + uri + bodyStr + nonce)
        .digest('base64');
    return {
        'Content-Type': 'application/json',
        'X-LINE-ChannelId': env_1.env.PAY.CHANNEL_ID,
        'X-LINE-Authorization-Nonce': nonce,
        'X-LINE-Authorization': signature,
    };
};
const requestPayment = async (orderId, amount, currency = 'THB') => {
    const body = {
        amount,
        currency,
        orderId,
        packages: [{ id: 'pkg1', amount, name: 'Order package' }],
        redirectUrls: {
            confirmUrl: env_1.env.PAY.CONFIRM_URL,
            cancelUrl: env_1.env.PAY.CONFIRM_URL,
        },
    };
    const uri = '/v3/payments/request';
    const res = await axios_1.http.post(env_1.env.PAY.BASE + uri, body, { headers: headers(uri, body) });
    return res.data;
};
exports.requestPayment = requestPayment;
const confirmPayment = async (transactionId, amount, currency = 'THB') => {
    const body = { amount, currency };
    const uri = `/v3/payments/${transactionId}/confirm`;
    const res = await axios_1.http.post(env_1.env.PAY.BASE + uri, body, { headers: headers(uri, body) });
    return res.data;
};
exports.confirmPayment = confirmPayment;
