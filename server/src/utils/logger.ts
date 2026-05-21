import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: ['req.headers.authorization', 'authorization', 'LLM_API_KEY', '*.apiKey']
});

