import { prisma } from '../config/db';
export const CampaignRepo = {
    create: async (data) => prisma.campaign.create({
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
    list: async () => prisma.campaign.findMany({
        orderBy: { createdAt: 'desc' },
    }),
    get: async (id) => prisma.campaign.findUnique({
        where: { id },
    }),
    recordDelivery: async (campaignId, audienceId, status, sentAt, error) => prisma.campaignDelivery.create({
        data: { campaignId, audienceId, status, sentAt, error },
    }),
};
