import dotenv from 'dotenv';

dotenv.config();

const intFromEnv = (key: string, fallback: number) => {
  const value = process.env[key];
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const numberFromEnv = (key: string, fallback: number) => {
  const value = process.env[key];
  if (!value) return fallback;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const config = {
  port: intFromEnv('PORT', 3000),
  authToken: process.env.APP_AUTH_TOKEN || '',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  dbPath: process.env.DB_PATH || './data/express.db',
  llm: {
    provider: process.env.LLM_PROVIDER || 'deepseek',
    apiBase: process.env.LLM_API_BASE || 'https://api.deepseek.com/v1',
    apiKey: process.env.LLM_API_KEY || '',
    model: process.env.LLM_MODEL || 'deepseek-chat',
    timeoutMs: intFromEnv('LLM_TIMEOUT_MS', 15000),
    maxRetries: intFromEnv('LLM_MAX_RETRIES', 1),
    maxInputChars: intFromEnv('LLM_MAX_INPUT_CHARS', 1000),
    temperature: numberFromEnv('LLM_TEMPERATURE', 0),
    maxOutputTokens: intFromEnv('LLM_MAX_OUTPUT_TOKENS', 800),
    dailyLimit: intFromEnv('LLM_DAILY_LIMIT', 1000)
  }
};

