"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventRepo = void 0;
const db_1 = require("../config/db");
exports.EventRepo = {
    record: async (type, payload, audienceId, occurredAt) => db_1.prisma.event.create({
        data: { type, payload, audienceId, occurredAt },
    }),
    stats: async () => {
        const total = await db_1.prisma.event.count();
        const byType = await db_1.prisma.event.groupBy({
            by: ['type'],
            _count: { type: true },
        });
        return { total, byType };
    },
    recent: async (limit = 100) => db_1.prisma.event.findMany({
        orderBy: { occurredAt: 'desc' },
        take: limit,
    }),
};
