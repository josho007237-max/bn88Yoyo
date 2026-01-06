// src/services/openai/getOpenAIClientForBot.ts

import OpenAI from "openai";

// type BotWithSecrets ใช้เฉพาะ field ที่ต้องการ
type BotWithSecrets = {
  id: string;
  tenant?: string | null;
  config?: {
    model?: string | null;
    temperature?: number | null;
    topP?: number | null;
    maxTokens?: number | null;
  } | null;
  secrets?: {
    openaiApiKey?: string | null;
  } | null;
};

export function getOpenAIClientForBot(bot: BotWithSecrets) {
  const apiKey =
    bot.secrets?.openaiApiKey || process.env.OPENAI_API_KEY || "";

  if (!apiKey) {
    throw new Error(
      `[openai] Missing API key for bot ${bot.id} (no BotSecret.openaiApiKey and no process.env.OPENAI_API_KEY)`
    );
  }

  const client = new OpenAI({
    apiKey,
  });

  return client;
}

