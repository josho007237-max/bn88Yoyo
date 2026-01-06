"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleWebhook = void 0;
const lineWebhook_service_1 = require("../services/lineWebhook.service");
const lineMessaging_service_1 = require("../services/lineMessaging.service");
const _botFlowEngine_1 = require("./_botFlowEngine");
const eventsBuffer_1 = require("../store/eventsBuffer");
const audience_repo_1 = require("../repositories/audience.repo");
const event_repo_1 = require("../repositories/event.repo");
const handleWebhook = async (req, res) => {
    const rawBody = JSON.stringify(req.body);
    const signature = req.header('x-line-signature') || '';
    if (!(0, lineWebhook_service_1.verifySignature)(rawBody, signature)) {
        return res.status(401).send('Invalid signature');
    }
    const events = req.body.events || [];
    for (const ev of events) {
        eventsBuffer_1.eventsBuffer.push(ev);
        if (ev.source?.userId) {
            await audience_repo_1.AudienceRepo.upsertByLineUser(ev.source.userId, { lastActiveAt: new Date() });
        }
        const audienceId = ev.source?.userId
            ? (await audience_repo_1.AudienceRepo.upsertByLineUser(ev.source.userId, {})).id
            : undefined;
        await event_repo_1.EventRepo.record(ev.type, ev, audienceId);
        if (ev.type === 'follow' && ev.replyToken) {
            if (ev.source?.userId) {
                await audience_repo_1.AudienceRepo.addTag(ev.source.userId, 'follower');
            }
            await lineMessaging_service_1.LineMessaging.reply(ev.replyToken, [
                { type: 'text', text: 'ยินดีต้อนรับครับ 🎉' },
            ]);
        }
        if (ev.type === 'message' && ev.message.type === 'text') {
            const replyActions = _botFlowEngine_1.BotFlowEngine.match(ev.message.text, ev.source, ev.replyToken);
            for (const act of replyActions) {
                if (act.type === 'reply') {
                    await lineMessaging_service_1.LineMessaging.reply(ev.replyToken, act.messages);
                }
                if (act.type === 'push' && ev.source?.userId) {
                    await lineMessaging_service_1.LineMessaging.push(ev.source.userId, act.messages);
                }
            }
        }
        if (ev.type === 'postback' && ev.replyToken) {
            const data = ev.postback.data || '';
            const actions = _botFlowEngine_1.BotFlowEngine.matchPostback(data, ev.source, ev.replyToken);
            for (const act of actions) {
                if (act.type === 'reply') {
                    await lineMessaging_service_1.LineMessaging.reply(ev.replyToken, act.messages);
                }
            }
            if (ev.source?.userId) {
                await audience_repo_1.AudienceRepo.addTag(ev.source.userId, 'engaged');
            }
        }
    }
    res.status(200).send('ok');
};
exports.handleWebhook = handleWebhook;
