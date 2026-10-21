import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { businessDateSql } from './businessDate.ts';

test('UTC+08 business-date filter includes both sides of the UTC midnight boundary', () => {
  const database = new DatabaseSync(':memory:');
  database.exec('CREATE TABLE records (created_at TEXT NOT NULL)');
  database.prepare('INSERT INTO records (created_at) VALUES (?)').run('2026-10-21 15:59:59');
  database.prepare('INSERT INTO records (created_at) VALUES (?)').run('2026-10-21 16:00:00');
  const sql = `SELECT count(*) AS count FROM records WHERE ${businessDateSql('created_at')} = ?`;
  assert.equal(database.prepare(sql).get('2026-10-21')?.count, 1);
  assert.equal(database.prepare(sql).get('2026-10-22')?.count, 1);
  database.close();
});
