"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudienceRepo = void 0;
const db_1 = require("../config/db");
exports.AudienceRepo = {
    upsertByLineUser: async (lineUserId, data) => {
        return db_1.prisma.audience.upsert({
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
        const a = await db_1.prisma.audience.findUnique({ where: { lineUserId } });
        const tags = Array.from(new Set([...(a?.tags ?? []), tag]));
        return db_1.prisma.audience.update({ where: { lineUserId }, data: { tags } });
    },
    list: async () => db_1.prisma.audience.findMany({ orderBy: { createdAt: 'desc' } }),
    findByTags: async (tags) => db_1.prisma.audience.findMany({
        where: { tags: { hasSome: tags } },
        orderBy: { createdAt: 'desc' },
    }),
};
