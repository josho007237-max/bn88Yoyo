import { prisma } from '../config/db';
export const AudienceRepo = {
    upsertByLineUser: async (lineUserId, data) => {
        return prisma.audience.upsert({
            where: { lineUserId },
            update: { ...data },
            create: {
                lineUserId,
                displayName: data.displayName,
                locale: data.locale,
                tags: data.tags ?? [],
                lastActiveAt: data.lastActiveAt,
            },
        });
    },
    addTag: async (lineUserId, tag) => {
        const a = await prisma.audience.findUnique({ where: { lineUserId } });
        const tags = Array.from(new Set([...(a?.tags ?? []), tag]));
        return prisma.audience.update({ where: { lineUserId }, data: { tags } });
    },
    list: async () => prisma.audience.findMany({ orderBy: { createdAt: 'desc' } }),
    findByTags: async (tags) => prisma.audience.findMany({
        where: { tags: { hasSome: tags } },
        orderBy: { createdAt: 'desc' },
    }),
};
