import { Queue } from "bullmq";
import { env } from "../config/env";
const connection = {
    host: env.REDIS_HOST,
    port: Number(env.REDIS_PORT),
};
export const messageQueue = new Queue("messages", { connection });
const baseOptions = (attempts) => ({
    attempts: attempts ?? 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 1000,
    removeOnFail: 1000,
});
export const enqueueMessage = async (payload) => {
    return messageQueue.add("send", payload, {
        ...baseOptions(payload.attempts),
        jobId: payload.idempotencyKey,
    });
};
export const scheduleMessage = async (payload) => {
    return messageQueue.add("send", payload, {
        ...baseOptions(payload.attempts),
        jobId: payload.idempotencyKey,
        repeat: {
            pattern: payload.cron,
            tz: payload.timezone,
        },
    });
};
