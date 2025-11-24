import { prisma } from "../lib/prisma";

export type AiConfig = {
  model: string;
  temperature?: number | null;
  topP?: number | null;
  maxTokens?: number | null;
  systemPrompt?: string | null;
};

export async function getAiConfigByBotId(
  botId: string,
): Promise<AiConfig> {
  const cfg = await prisma.botConfig.findUnique({
    where: { botId },
  });

  return {
    model: cfg?.model ?? "gpt-4o-mini",
    temperature: cfg?.temperature ?? 0.3,
    topP: cfg?.topP ?? 1,
    maxTokens: cfg?.maxTokens ?? 800,
    systemPrompt: cfg?.systemPrompt ?? "",
  };
}

export async function upsertAiConfig(
  botId: string,
  tenant: string,
  patch: Partial<AiConfig>,
): Promise<AiConfig> {
  const data = {
    tenant,
    model: patch.model ?? "gpt-4o-mini",
    temperature: patch.temperature ?? 0.3,
    topP: patch.topP ?? 1,
    maxTokens: patch.maxTokens ?? 800,
    systemPrompt: patch.systemPrompt ?? "",
  };

  const cfg = await prisma.botConfig.upsert({
    where: { botId },
    create: { botId, ...data },
    update: data,
  });

  return {
    model: cfg.model,
    temperature: cfg.temperature,
    topP: cfg.topP,
    maxTokens: cfg.maxTokens,
    systemPrompt: cfg.systemPrompt,
  };
}
