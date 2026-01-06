"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startProcessor = void 0;
const bullmq_1 = require("bullmq");
const lineMessaging_service_1 = require("../services/lineMessaging.service");
const campaign_repo_1 = require("../repositories/campaign.repo");
const env_1 = require("../config/env");
const connection = {
    host: env_1.env.REDIS_HOST,
    port: env_1.env.REDIS_PORT,
};
const startProcessor = () => {
    const worker = new bullmq_1.Worker('messages', async (job) => {
        const { to, messages, campaignId, audienceId } = job.data;
        try {
            await lineMessaging_service_1.LineMessaging.push(to, messages);
            if (campaignId && audienceId) {
                await campaign_repo_1.CampaignRepo.recordDelivery(campaignId, audienceId, 'sent', new Date());
            }
            return { ok: true };
        }
        catch (err) {
            if (campaignId && audienceId) {
                await campaign_repo_1.CampaignRepo.recordDelivery(campaignId, audienceId, 'failed', undefined, err?.message);
            }
            throw err;
        }
    }, {
        connection,
        concurrency: env_1.env.WORKER.CONCURRENCY,
        limiter: {
            max: env_1.env.WORKER.RATE_MAX,
            duration: env_1.env.WORKER.RATE_DURATION_MS,
        },
    });
    worker.on('completed', job => {
        console.log('Job completed', job.id);
    });
    worker.on('failed', (job, err) => {
        console.error('Job failed', job?.id, err?.message || err);
    });
    return worker;
};
exports.startProcessor = startProcessor;
