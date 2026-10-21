import { config } from '../config/index.js';
import { db } from '../db/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { reserveDailyLlmQuota } from './llmQuota.js';

export function reserveLlmCall() {
  const usageDate = new Date().toISOString().slice(0, 10);
  if (!reserveDailyLlmQuota(db, config.llm.dailyLimit, usageDate)) {
    throw new AppError(1017, 429, '今日 LLM 调用额度已用尽，请明日再试');
  }
}
