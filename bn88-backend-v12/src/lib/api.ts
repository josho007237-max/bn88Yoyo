// src/lib/api.ts
import axios from "axios";

/**
 * HTTP client สำหรับให้ backend เรียก API อื่น (ถ้าจำเป็น)
 * ใช้ ADMIN_API_BASE จาก environment
 */
export const API: any = axios.create({
  baseURL: process.env.ADMIN_API_BASE || "",
  timeout: 15000,
});

/* ======================= Types: Bot AI Config ======================= */

export type BotAiConfig = {
  botId: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  topP?: number;
  maxTokens?: number;
};

export type BotAiConfigResponse = {
  ok: boolean;
  config: BotAiConfig | null;
  allowedModels: string[];
};

/* ======================= Helper functions ======================= */

/**
 * ดึง Bot AI Config ผ่าน HTTP
 */
export async function getBotConfig(
  botId: string
): Promise<BotAiConfigResponse> {
  const res = await API.get(
    `/api/admin/bots/${encodeURIComponent(botId)}/config`
  );
  return res.data as BotAiConfigResponse;
}

/**
 * อัปเดต Bot AI Config ผ่าน HTTP
 */
export async function updateBotConfig(
  botId: string,
  payload: Partial<BotAiConfig>
): Promise<BotAiConfigResponse> {
  const res = await API.put(
    `/api/admin/bots/${encodeURIComponent(botId)}/config`,
    payload
  );
  return res.data as BotAiConfigResponse;
}

