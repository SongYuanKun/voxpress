import assert from 'node:assert/strict';
import { closeSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { Worker } from 'node:worker_threads';
import { reserveDailyLlmQuota } from './llmQuota.ts';

function quotaDb(filename: string) {
  const database = new DatabaseSync(filename);
  database.exec('CREATE TABLE IF NOT EXISTS llm_usage (usage_date TEXT PRIMARY KEY, used_calls INTEGER NOT NULL DEFAULT 0)');
  return {
    database,
    adapter: {
      prepare: (sql: string) => database.prepare(sql),
      transaction: <T>(fn: () => T) => () => {
        database.exec('BEGIN IMMEDIATE');
        try {
          const result = fn();
          database.exec('COMMIT');
          return result;
        } catch (error) {
          database.exec('ROLLBACK');
          throw error;
        }
      }
    }
  };
}

test('quota survives reopening a temporary SQLite database and enforces the shared limit', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'voxpress-quota-'));
  const filename = path.join(directory, 'quota.db');
  try {
    const first = quotaDb(filename);
    assert.equal(reserveDailyLlmQuota(first.adapter, 2, '2026-10-21'), true);
    first.database.close();
    const restarted = quotaDb(filename);
    assert.equal(reserveDailyLlmQuota(restarted.adapter, 2, '2026-10-21'), true);
    assert.equal(reserveDailyLlmQuota(restarted.adapter, 2, '2026-10-21'), false);
    assert.equal(restarted.database.prepare('SELECT used_calls FROM llm_usage').get()?.used_calls, 2);
    restarted.database.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

function reserveInWorker(filename: string, moduleUrl: string) {
  const source = `
    const { parentPort, workerData } = require('node:worker_threads');
    const { DatabaseSync } = require('node:sqlite');
    (async () => {
      const { reserveDailyLlmQuota } = await import(workerData.moduleUrl);
      const database = new DatabaseSync(workerData.filename);
      database.exec('PRAGMA busy_timeout = 5000');
      const adapter = {
        prepare: (sql) => database.prepare(sql),
        transaction: (fn) => () => {
          database.exec('BEGIN IMMEDIATE');
          try { const result = fn(); database.exec('COMMIT'); return result; }
          catch (error) { database.exec('ROLLBACK'); throw error; }
        }
      };
      const reserved = reserveDailyLlmQuota(adapter, 3, '2026-10-21');
      database.close();
      parentPort.postMessage({ reserved });
    })().catch((error) => parentPort.postMessage({ error: String(error) }));
  `;
  return new Promise<boolean>((resolve, reject) => {
    const worker = new Worker(source, { eval: true, workerData: { filename, moduleUrl } });
    worker.once('message', (message) => message.error ? reject(new Error(message.error)) : resolve(message.reserved));
    worker.once('error', reject);
  });
}

test('separate SQLite connections concurrently reserve no more than the daily limit', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'voxpress-quota-concurrent-'));
  const filename = path.join(directory, 'quota.db');
  try {
    quotaDb(filename).database.close();
    const moduleUrl = new URL('./llmQuota.ts', import.meta.url).href;
    const results = await Promise.all(Array.from({ length: 12 }, () => reserveInWorker(filename, moduleUrl)));
    assert.equal(results.filter(Boolean).length, 3);
    const database = new DatabaseSync(filename);
    assert.equal(database.prepare('SELECT used_calls FROM llm_usage').get()?.used_calls, 3);
    database.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
