"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CampaignRepo = void 0;
const db_1 = require("../config/db");
exports.CampaignRepo = {
    create: async (data) => db_1.prisma.campaign.create({
        data: {
            name: data.name,
            scheduleStart: data.scheduleStart ? new Date(data.scheduleStart) : undefined,
            scheduleEnd: data.scheduleEnd ? new Date(data.scheduleEnd) : undefined,
            cron: data.cron,
            enabled: data.enabled ?? true,
            segmentType: data.segmentType,
            segmentQuery: data.segmentQuery,
            message: data.message,
        },
    }),
    list: async () => db_1.prisma.campaign.findMany({
        orderBy: { createdAt: 'desc' },
    }),
    get: async (id) => db_1.prisma.campaign.findUnique({
        where: { id },
    }),
    recordDelivery: async (campaignId, audienceId, status, sentAt, error) => db_1.prisma.campaignDelivery.create({
        data: { campaignId, audienceId, status, sentAt, error },
    }),
};
