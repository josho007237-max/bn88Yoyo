import { http } from '../utils/axios';
import { env } from '../config/env';
const base = 'https://api.line.me/v2/bot';
const headers = {
    Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
};
export const LineMessaging = {
    reply: async (replyToken, messages) => {
        return http.post(`${base}/message/reply`, { replyToken, messages }, { headers });
    },
    push: async (to, messages) => {
        return http.post(`${base}/message/push`, { to, messages }, { headers });
    },
    multicast: async (to, messages) => {
        return http.post(`${base}/message/multicast`, { to, messages }, { headers });
    },
    broadcast: async (messages) => {
        return http.post(`${base}/message/broadcast`, { messages }, { headers });
    },
    getProfile: async (userId) => {
        return http.get(`${base}/profile/${userId}`, { headers });
    },
    getRichMenuList: async () => {
        return http.get(`${base}/richmenu/list`, { headers });
    },
    linkRichMenuToUser: async (userId, richMenuId) => {
        return http.post(`${base}/richmenu/user/${userId}`, { richMenuId }, { headers });
    },
};
