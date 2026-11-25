import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import Database from 'better-sqlite3';
import { runMigrations } from './migrate.ts';

test('migration adds platform/photo columns and converts quantity to REAL', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'voxpress-migrate-'));
  const dbPath = path.join(directory, 'legacy.db');
  const db = new Database(dbPath);
  try {
    db.exec(`
      CREATE TABLE express_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_request_id TEXT UNIQUE NOT NULL,
        tracking_number TEXT NOT NULL,
        raw_text TEXT NOT NULL,
        original_json TEXT NOT NULL,
        custom_json TEXT NOT NULL,
        status INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE express_record_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        record_id INTEGER NOT NULL,
        item_name TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit TEXT DEFAULT '',
        is_original INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(record_id) REFERENCES express_records(id) ON DELETE CASCADE
      );
    `);

    db.prepare(
      `INSERT INTO express_records (client_request_id, tracking_number, raw_text, original_json, custom_json)
       VALUES (?, ?, ?, ?, ?)`
    ).run('req-1', 'TN-1', '黄金 1 克', '{"items":[]}', '{"items":[]}');
    db.prepare(
      `INSERT INTO express_record_items (record_id, item_name, quantity, unit, is_original)
       VALUES (?, ?, ?, ?, ?)`
    ).run(1, '黄金', 1, '克', 0);

    runMigrations(db);
    runMigrations(db); // idempotent

    const columns = db.pragma('table_info(express_records)') as Array<{ name: string }>;
    const names = columns.map((column) => column.name);
    assert.ok(names.includes('platform'));
    assert.ok(names.includes('platform_order_note'));
    assert.ok(names.includes('weighing_photo'));
    assert.ok(names.includes('packing_photo'));

    const quantityCol = (db.pragma('table_info(express_record_items)') as Array<{ name: string; type: string }>)
      .find((column) => column.name === 'quantity');
    assert.equal(quantityCol?.type.toUpperCase(), 'REAL');

    db.prepare('INSERT INTO express_record_items (record_id, item_name, quantity, unit, is_original) VALUES (?, ?, ?, ?, ?)')
      .run(1, '白银', 3.2, '克', 0);
    const row = db.prepare('SELECT quantity FROM express_record_items WHERE item_name = ?').get('白银') as { quantity: number };
    assert.equal(row.quantity, 3.2);
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
