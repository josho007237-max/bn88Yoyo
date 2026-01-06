"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventsFeed = void 0;
const event_repo_1 = require("../repositories/event.repo");
const db_1 = require("../config/db");
const eventsFeed = async (_req, res) => {
    const last100 = await event_repo_1.EventRepo.recent(100);
    const stats = await event_repo_1.EventRepo.stats();
    const deliveries = await db_1.prisma.campaignDelivery.count({
        where: { status: 'sent' },
    });
    res.json({
        metrics: {
            totalEvents: stats.total,
            byType: stats.byType,
            deliveriesSent: deliveries,
        },
        last100,
    });
};
exports.eventsFeed = eventsFeed;
