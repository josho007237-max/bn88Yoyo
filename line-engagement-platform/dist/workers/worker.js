"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const processor_1 = require("./processor");
const db_1 = require("../config/db");
const logger_1 = require("../utils/logger");
async function boot() {
    try {
        (0, logger_1.log)('Worker starting...');
        await db_1.prisma.$connect();
        (0, logger_1.log)('Prisma connected');
        const worker = (0, processor_1.startProcessor)();
        (0, logger_1.log)('Processor started');
        const shutdown = async () => {
            (0, logger_1.log)('Shutting down worker...');
            await worker.close();
            await db_1.prisma.$disconnect();
            process.exit(0);
        };
        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
    }
    catch (err) {
        console.error('Worker boot error', err);
        process.exit(1);
    }
}
boot();
