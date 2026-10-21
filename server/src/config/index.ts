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

// Only explicitly named proxy hops may supply X-Forwarded-For.  A bare
// `true` would let every client choose its own rate-limit identity.
const trustedProxy = (() => {
  const value = (process.env.TRUST_PROXY || '').trim();
  const entries = value ? value.split(',').map((entry) => entry.trim()).filter(Boolean) : [];
  if (entries.some((entry) => entry === 'true' || /^\d+$/.test(entry))) {
    throw new Error('TRUST_PROXY 必须是反向代理源 IP 或 CIDR，不能使用 true 或跳数');
  }
  return entries.length ? entries : false;
})();
const reverseProxy = process.env.REVERSE_PROXY === 'true';
if (reverseProxy && !trustedProxy) {
  throw new Error('REVERSE_PROXY=true 时必须设置 TRUST_PROXY 为反向代理源 IP 或 CIDR');
}

export const config = {
  port: intFromEnv('PORT', 3000),
  host: process.env.HOST || '127.0.0.1',
  authToken: process.env.APP_AUTH_TOKEN || '',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  trustedProxy,
  reverseProxy,
  dbPath: process.env.DB_PATH || './data/express.db',
  uploadDir: process.env.UPLOAD_DIR || './data/uploads',
  backup: {
    dir: process.env.BACKUP_DIR || './backups',
    retentionDays: intFromEnv('BACKUP_RETENTION_DAYS', 7)
  },
  video: {
    maxUploadMb: intFromEnv('VIDEO_MAX_UPLOAD_MB', 80),
    frameCount: intFromEnv('VIDEO_FRAME_COUNT', 4),
    frameWidth: intFromEnv('VIDEO_FRAME_WIDTH', 1280)
  },
  llm: {
    provider: process.env.LLM_PROVIDER || 'deepseek',
    apiBase: process.env.LLM_API_BASE || 'https://api.deepseek.com/v1',
    apiKey: process.env.LLM_API_KEY || '',
    model: process.env.LLM_MODEL || 'deepseek-chat',
    timeoutMs: intFromEnv('LLM_TIMEOUT_MS', 15000),
    maxInputChars: intFromEnv('LLM_MAX_INPUT_CHARS', 1000),
    temperature: numberFromEnv('LLM_TEMPERATURE', 0),
    maxOutputTokens: intFromEnv('LLM_MAX_OUTPUT_TOKENS', 800),
    dailyLimit: intFromEnv('LLM_DAILY_LIMIT', 1000)
  },
  asr: {
    provider: process.env.ASR_PROVIDER || process.env.LLM_PROVIDER || 'openai-compatible',
    apiBase: process.env.ASR_API_BASE || process.env.LLM_API_BASE || 'https://api.openai.com/v1',
    apiKey: process.env.ASR_API_KEY || process.env.LLM_API_KEY || '',
    model: process.env.ASR_MODEL || 'whisper-1',
    timeoutMs: intFromEnv('ASR_TIMEOUT_MS', 60_000)
  }
};
