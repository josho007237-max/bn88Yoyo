"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendFlexSample = exports.sendBroadcast = void 0;
const lineMessaging_service_1 = require("../services/lineMessaging.service");
const sendBroadcast = async (req, res) => {
    const { messages } = req.body;
    await lineMessaging_service_1.LineMessaging.broadcast(messages);
    res.json({ ok: true });
};
exports.sendBroadcast = sendBroadcast;
const sendFlexSample = async (_req, res) => {
    const flex = {
        type: 'flex',
        altText: 'โปรโมชันใหม่!',
        contents: {
            type: 'bubble',
            hero: {
                type: 'image',
                url: 'https://picsum.photos/600/400',
                size: 'full',
                aspectRatio: '20:13',
                aspectMode: 'cover',
            },
            body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    { type: 'text', text: 'Flash Sale', weight: 'bold', size: 'xl' },
                    { type: 'text', text: 'ลด 30% วันนี้เท่านั้น', size: 'sm', color: '#555555' },
                ],
            },
            footer: {
                type: 'box',
                layout: 'horizontal',
                contents: [
                    {
                        type: 'button',
                        style: 'primary',
                        color: '#00B900',
                        action: { type: 'uri', label: 'เปิดเมนู', uri: 'https://line.me' },
                    },
                    {
                        type: 'button',
                        style: 'secondary',
                        action: { type: 'postback', label: 'รับคูปอง', data: 'coupon=FLASH30' },
                    },
                ],
            },
        },
    };
    res.json({ message: flex });
};
exports.sendFlexSample = sendFlexSample;
