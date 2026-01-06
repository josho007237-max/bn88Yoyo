import { Queue, JobsOptions } from "bullmq";
import { env } from "../config/env";

const connection = {
  host: env.REDIS_HOST,
  port: Number(env.REDIS_PORT),
};

export const messageQueue = new Queue("messages", { connection });

const baseOptions = (attempts?: number): JobsOptions => ({
  attempts: attempts ?? 3,
  backoff: { type: "exponential", delay: 5000 },
  removeOnComplete: 1000,
  removeOnFail: 1000,
});

export type EnqueueMessagePayload = {
  to: string;
  messages: any[];
  campaignId?: string;
  audienceId?: string;
  attempts?: number;
  idempotencyKey?: string;
};

export const enqueueMessage = async (payload: EnqueueMessagePayload) => {
  return messageQueue.add("send", payload, {
    ...baseOptions(payload.attempts),
    jobId: payload.idempotencyKey,
  });
};

export type ScheduleMessagePayload = {
  to: string;
  messages: any[];
  campaignId?: string;
  audienceId?: string;
  cron: string;
  timezone: string;
  attempts?: number; // ใส่ไว้ได้ (optional) เผื่ออยากปรับภายหลัง
  idempotencyKey?: string;
};

export const scheduleMessage = async (payload: ScheduleMessagePayload) => {
  return messageQueue.add("send", payload, {
    ...baseOptions(payload.attempts),
    jobId: payload.idempotencyKey,
    repeat: {
      pattern: payload.cron,
      tz: payload.timezone,
    },
  });
};
