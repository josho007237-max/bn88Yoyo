// src/queues/message.queue.ts
export type EnqueueRateLimitedSendArgs = {
  id: string;
  channelId: string;
  requestId?: string;
  handler: () => Promise<any>;
};

export type EnqueueRateLimitedSendResult = {
  scheduled: boolean;
  delayMs?: number;
  result?: any;
};

/**
 * เวอร์ชัน "ให้ผ่าน typecheck + ใช้งานได้ทันที"
 * - ยังไม่ทำ rate-limit จริง (รันทันที)
 * - คืน shape ที่ call-site ต้องใช้ (scheduled/result/delayMs)
 */
export async function enqueueRateLimitedSend(
  args: EnqueueRateLimitedSendArgs
): Promise<EnqueueRateLimitedSendResult> {
  const result = await args.handler();
  return { scheduled: false, delayMs: 0, result };
}

/**
 * ใช้ใน followUp.ts
 * ตอนนี้ทำเป็น no-op ที่คืน jobId กลับไปก่อน
 */
export async function enqueueFollowUpJob(
  payload: any
): Promise<{ jobId: string }> {
  const jobId = payload?.id ?? `followup:${Date.now()}`;
  return { jobId };
}

/**
 * ใช้ใน engagementScheduler.ts
 * ตอนนี้ทำเป็น no-op ที่คืน jobId กลับไปก่อน
 */
export async function scheduleMessageJob(
  payload: any
): Promise<{ jobId: string }> {
  const jobId = payload?.id ?? `schedule:${Date.now()}`;
  return { jobId };
}

/**
 * server.ts เรียกตอนบูตระบบ
 * เวอร์ชันนี้เป็น no-op ก่อน (ให้ผ่าน build)
 */
export function startMessageWorker(): void {
  // no-op
}

