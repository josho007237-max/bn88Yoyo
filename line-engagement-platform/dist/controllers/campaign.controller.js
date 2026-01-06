"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginCallback = exports.loginStart = exports.enqueueCampaign = exports.scheduleCampaign = exports.listAudience = void 0;
const audience_repo_1 = require("../repositories/audience.repo");
const campaign_repo_1 = require("../repositories/campaign.repo");
const lineLogin_service_1 = require("../services/lineLogin.service");
const message_queue_1 = require("../queues/message.queue");
const logger_1 = require("../utils/logger");
const listAudience = async (_req, res) => {
    const users = await audience_repo_1.AudienceRepo.list();
    res.json({ users });
};
exports.listAudience = listAudience;
const scheduleCampaign = async (req, res) => {
    const { campaign } = req.body;
    const created = await campaign_repo_1.CampaignRepo.create({
        name: campaign.name,
        scheduleStart: campaign.schedule?.startAt,
        scheduleEnd: campaign.schedule?.endAt,
        cron: campaign.schedule?.cron,
        enabled: campaign.enabled,
        segmentType: campaign.segment.type,
        segmentQuery: campaign.segment,
        message: campaign.message,
    });
    let targets = [];
    if (campaign.segment.type === 'tag') {
        const byTags = await audience_repo_1.AudienceRepo.findByTags(campaign.segment.tags);
        targets = byTags.map(u => ({ id: u.id, lineUserId: u.lineUserId }));
    }
    else {
        const all = await audience_repo_1.AudienceRepo.list();
        targets = all.map(u => ({ id: u.id, lineUserId: u.lineUserId }));
    }
    res.json({ ok: true, campaignId: created.id, sentTo: targets.length });
};
exports.scheduleCampaign = scheduleCampaign;
const enqueueCampaign = async (req, res) => {
    try {
        const { campaign } = req.body;
        if (!campaign || !campaign.name || !campaign.message || !campaign.segment) {
            return res
                .status(400)
                .json({ error: 'Missing campaign.name or campaign.message or campaign.segment' });
        }
        const created = await campaign_repo_1.CampaignRepo.create({
            name: campaign.name,
            scheduleStart: campaign.schedule?.startAt,
            scheduleEnd: campaign.schedule?.endAt,
            cron: campaign.schedule?.cron,
            enabled: campaign.enabled ?? true,
            segmentType: campaign.segment.type,
            segmentQuery: campaign.segment,
            message: campaign.message,
        });
        let targets = [];
        if (campaign.segment.type === 'tag' && Array.isArray(campaign.segment.tags)) {
            targets = await audience_repo_1.AudienceRepo.findByTags(campaign.segment.tags);
        }
        else {
            targets = await audience_repo_1.AudienceRepo.list();
        }
        let queued = 0;
        for (const t of targets) {
            await (0, message_queue_1.enqueueMessage)({
                to: t.lineUserId,
                messages: [campaign.message],
                campaignId: created.id,
                audienceId: t.id,
            });
            queued++;
        }
        (0, logger_1.log)(`Enqueued ${queued} jobs for campaign ${created.id}`);
        return res.json({ ok: true, campaignId: created.id, queued });
    }
    catch (err) {
        console.error('enqueueCampaign error', err);
        return res.status(500).json({ error: err?.message || 'internal error' });
    }
};
exports.enqueueCampaign = enqueueCampaign;
const loginStart = async (_req, res) => {
    const url = (0, lineLogin_service_1.getLoginUrl)('state123');
    res.json({ url });
};
exports.loginStart = loginStart;
const loginCallback = async (req, res) => {
    const { code } = req.query;
    const token = await (0, lineLogin_service_1.exchangeToken)(code);
    const profile = await (0, lineLogin_service_1.getProfile)(token.access_token);
    await audience_repo_1.AudienceRepo.upsertByLineUser(profile.userId, {
        displayName: profile.displayName,
        lastActiveAt: new Date(),
        tags: ['logged_in'],
    });
    res.json({ ok: true, profile });
};
exports.loginCallback = loginCallback;
