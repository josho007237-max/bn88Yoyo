"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProfile = exports.exchangeToken = exports.getLoginUrl = void 0;
const axios_1 = require("../utils/axios");
const env_1 = require("../config/env");
const querystring_1 = __importDefault(require("querystring"));
const getLoginUrl = (state) => {
    const q = querystring_1.default.stringify({
        response_type: 'code',
        client_id: env_1.env.LOGIN.ID,
        redirect_uri: env_1.env.LOGIN.REDIRECT,
        state,
        scope: 'profile openid email',
        prompt: 'consent',
    });
    return `https://access.line.me/oauth2/v2.1/authorize?${q}`;
};
exports.getLoginUrl = getLoginUrl;
const exchangeToken = async (code) => {
    const data = querystring_1.default.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: env_1.env.LOGIN.REDIRECT,
        client_id: env_1.env.LOGIN.ID,
        client_secret: env_1.env.LOGIN.SECRET,
    });
    const res = await axios_1.http.post('https://api.line.me/oauth2/v2.1/token', data, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return res.data;
};
exports.exchangeToken = exchangeToken;
const getProfile = async (accessToken) => {
    const res = await axios_1.http.get('https://api.line.me/v2/profile', {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.data;
};
exports.getProfile = getProfile;
