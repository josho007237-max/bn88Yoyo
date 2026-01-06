"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LineMessaging = void 0;
const axios_1 = require("../utils/axios");
const env_1 = require("../config/env");
const base = 'https://api.line.me/v2/bot';
const headers = {
    Authorization: `Bearer ${env_1.env.LINE_CHANNEL_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
};
exports.LineMessaging = {
    reply: async (replyToken, messages) => {
        return axios_1.http.post(`${base}/message/reply`, { replyToken, messages }, { headers });
    },
    push: async (to, messages) => {
        return axios_1.http.post(`${base}/message/push`, { to, messages }, { headers });
    },
    multicast: async (to, messages) => {
        return axios_1.http.post(`${base}/message/multicast`, { to, messages }, { headers });
    },
    broadcast: async (messages) => {
        return axios_1.http.post(`${base}/message/broadcast`, { messages }, { headers });
    },
    getProfile: async (userId) => {
        return axios_1.http.get(`${base}/profile/${userId}`, { headers });
    },
    getRichMenuList: async () => {
        return axios_1.http.get(`${base}/richmenu/list`, { headers });
    },
    linkRichMenuToUser: async (userId, richMenuId) => {
        return axios_1.http.post(`${base}/richmenu/user/${userId}`, { richMenuId }, { headers });
    },
};
