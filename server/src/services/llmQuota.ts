type Statement = { run: (...params: unknown[]) => { changes: number } };
type QuotaDatabase = {
  prepare: (sql: string) => Statement;
  transaction: <T>(fn: () => T) => () => T;
};

/** Atomically reserve one outbound LLM call for a UTC calendar day. */
export function reserveDailyLlmQuota(db: QuotaDatabase, dailyLimit: number, usageDate: string) {
  const reserve = db.transaction(() => {
    db.prepare(
      'INSERT INTO llm_usage (usage_date, used_calls) VALUES (?, 0) ON CONFLICT(usage_date) DO NOTHING'
    ).run(usageDate);
    return db.prepare(
      'UPDATE llm_usage SET used_calls = used_calls + 1 WHERE usage_date = ? AND used_calls < ?'
    ).run(usageDate, dailyLimit).changes === 1;
  });
  return reserve();
}
