import { prisma } from '../config/db';
export const CampaignRepo = {
    create: async (data) => prisma.campaign.create({
        data: {
            name: data.name,
            message: typeof data.message === 'string' ? data.message : JSON.stringify(data.message),
            messagePayload: data.message,
            scheduleStart: data.scheduleStart ? new Date(data.scheduleStart) : undefined,
            scheduleEnd: data.scheduleEnd ? new Date(data.scheduleEnd) : undefined,
            cron: data.cron,
            enabled: data.enabled ?? true,
            segmentType: data.segmentType,
            segmentQuery: data.segmentQuery,
        },
    }),
    createDraft: async (data) => prisma.campaign.create({
        data: {
            name: data.name,
            message: data.message,
            totalTargets: data.totalTargets,
            status: 'draft',
        },
    }),
    list: async () => prisma.campaign.findMany({
        orderBy: { createdAt: 'desc' },
    }),
    listPaginated: async (page, pageSize) => {
        const [items, total] = await Promise.all([
            prisma.campaign.findMany({
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            prisma.campaign.count(),
        ]);
        return { items, total };
    },
    get: async (id) => prisma.campaign.findUnique({
        where: { id },
    }),
    recordDelivery: async (campaignId, audienceId, status, sentAt, error) => prisma.campaignDelivery.create({
        data: { campaignId, audienceId, status, sentAt, error },
    }),
    setStatus: async (id, status) => prisma.campaign.update({
        where: { id },
        data: { status },
    }),
    incrementCounts: async (id, sentDelta, failedDelta) => prisma.campaign.update({
        where: { id },
        data: {
            sentCount: { increment: sentDelta },
            failedCount: { increment: failedDelta },
        },
    }),
    listSchedules: async (campaignId) => prisma.campaignSchedule.findMany({
        where: { campaignId },
        orderBy: { createdAt: 'desc' },
    }),
    createSchedule: async (data) => prisma.campaignSchedule.create({
        data: {
            campaignId: data.campaignId,
            cron: data.cron,
            timezone: data.timezone,
            startAt: data.startAt,
            endAt: data.endAt,
            idempotencyKey: data.idempotencyKey,
            repeatJobKey: data.repeatJobKey ?? undefined,
        },
    }),
    updateSchedule: async (scheduleId, data) => prisma.campaignSchedule.update({
        where: { id: scheduleId },
        data,
    }),
    deleteSchedule: async (scheduleId) => prisma.campaignSchedule.delete({ where: { id: scheduleId } }),
    getSchedule: async (scheduleId) => prisma.campaignSchedule.findUnique({ where: { id: scheduleId } }),
};
