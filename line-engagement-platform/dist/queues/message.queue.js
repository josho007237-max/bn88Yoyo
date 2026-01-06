"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enqueueMessage = exports.messageQueue = void 0;
const bullmq_1 = require("bullmq");
const env_1 = require("../config/env");
const connection = {
    host: env_1.env.REDIS_HOST,
    port: env_1.env.REDIS_PORT,
};
exports.messageQueue = new bullmq_1.Queue('messages', { connection });
const enqueueMessage = async (payload) => {
    return exports.messageQueue.add('send', payload, {
        attempts: payload.attempts ?? 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 1000,
        removeOnFail: 1000,
    });
};
exports.enqueueMessage = enqueueMessage;
