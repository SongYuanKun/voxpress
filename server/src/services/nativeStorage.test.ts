import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import Database from 'better-sqlite3';

test('compiled quota and backup services preserve real native SQLite data', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'voxpress-native-storage-'));
  const overrides = {
    NODE_ENV: 'test',
    DB_PATH: path.join(directory, 'source.db'),
    BACKUP_DIR: path.join(directory, 'backups'),
    LLM_DAILY_LIMIT: '1',
    LLM_API_KEY: '',
    ASR_API_KEY: '',
    TRUST_PROXY: '',
    REVERSE_PROXY: 'false'
  };
  const previous = Object.fromEntries(Object.keys(overrides).map(key => [key, process.env[key]]));
  let source: Database.Database | undefined;
  let copy: Database.Database | undefined;
  try {
    Object.assign(process.env, overrides);
    const { db }: typeof import('../db/index.js') = await import(
      new URL('../../dist/db/index.js', import.meta.url).href
    );
    source = db;
    assert.equal(db.name, overrides.DB_PATH);
    const { config }: typeof import('../config/index.js') = await import(
      new URL('../../dist/config/index.js', import.meta.url).href
    );
    assert.equal(config.backup.dir, overrides.BACKUP_DIR);
    const { reserveLlmCall }: typeof import('./llmQuotaService.js') = await import(
      new URL('../../dist/services/llmQuotaService.js', import.meta.url).href
    );
    reserveLlmCall();
    assert.throws(() => reserveLlmCall(), (error: unknown) =>
      error instanceof Error && 'code' in error && error.code === 1017 &&
      'status' in error && error.status === 429
    );
    db.prepare('INSERT INTO express_records (client_request_id, tracking_number, raw_text, original_json, custom_json) VALUES (?, ?, ?, ?, ?)')
      .run('fixture-request', 'FIXTURE-TRACKING', 'fixture input', '{}', '{}');
    const { createDatabaseBackup }: typeof import('./backupService.js') = await import(
      new URL('../../dist/services/backupService.js', import.meta.url).href
    );
    const result = await createDatabaseBackup();
    assert.equal(path.dirname(result.filePath), overrides.BACKUP_DIR);
    assert.equal(result.recordCount, 1);
    copy = new Database(result.filePath, { readonly: true, fileMustExist: true });
    assert.equal(copy.pragma('integrity_check', { simple: true }), 'ok');
    assert.equal(copy.prepare<[], { tracking_number: string }>('SELECT tracking_number FROM express_records').get()?.tracking_number, 'FIXTURE-TRACKING');
    assert.equal(copy.prepare<[], { used: number }>('SELECT SUM(used_calls) AS used FROM llm_usage').get()?.used, 1);
    assert.equal(db.prepare<[], { count: number }>('SELECT COUNT(*) AS count FROM backup_logs').get()?.count, 1);
  } finally {
    copy?.close();
    source?.close();
    for (const key of Object.keys(overrides)) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
    rmSync(directory, { recursive: true, force: true });
  }
});
