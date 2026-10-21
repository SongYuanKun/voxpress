import { config } from '../config/index.js';
import { db } from '../db/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { reserveDailyLlmQuota, type QuotaParameter } from './llmQuota.js';

const quotaDatabase = {
  prepare: (sql: string) => db.prepare<QuotaParameter[]>(sql),
  transaction: <T>(fn: () => T) => db.transaction(fn)
};

export function reserveLlmCall() {
  const usageDate = new Date().toISOString().slice(0, 10);
  if (!reserveDailyLlmQuota(quotaDatabase, config.llm.dailyLimit, usageDate)) {
    throw new AppError(1017, 429, '今日 LLM 调用额度已用尽，请明日再试');
  }
}
