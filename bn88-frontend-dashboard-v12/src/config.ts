// src/config.ts
const env = import.meta.env as unknown as Record<string, string | undefined>;

export const config = {
  OPENAI_API_KEY: env.VITE_OPENAI_API_KEY,
  OPENAI_MODEL: env.VITE_OPENAI_MODEL,
};
