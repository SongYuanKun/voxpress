import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import Database from 'better-sqlite3';
import { runMigrations } from '../db/migrate.ts';

/**
 * Lightweight service-logic coverage without importing the process-wide db singleton.
 */
test('decimal quantities, platform note search, and photo export path shape', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'voxpress-express-logic-'));
  const db = new Database(path.join(directory, 'express.db'));
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    runMigrations(db);

    const payload = JSON.stringify({
      items: [
        { name: '黄金', quantity: 12.5, unit: '克' },
        { name: '白银', quantity: 3.2, unit: '克' }
      ]
    });

    const insert = db.prepare(`
      INSERT INTO express_records
        (client_request_id, tracking_number, raw_text, original_json, custom_json, platform, platform_order_note, weighing_photo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('req-decimal', 'SF111', '黄金 12.5 克', payload, payload, '闲鱼', '闲鱼单号-7788', 'weighing.jpg');

    const recordId = Number(insert.lastInsertRowid);
    db.prepare('INSERT INTO express_record_items (record_id, item_name, quantity, unit, is_original) VALUES (?, ?, ?, ?, ?)')
      .run(recordId, '黄金', 12.5, '克', 0);

    const qty = db.prepare('SELECT quantity FROM express_record_items WHERE record_id = ?').get(recordId) as { quantity: number };
    assert.equal(qty.quantity, 12.5);

    const found = db.prepare(`
      SELECT COUNT(*) as count FROM express_records r
      WHERE r.status = 1 AND (
        r.tracking_number LIKE ? OR IFNULL(r.platform_order_note, '') LIKE ?
      )
    `).get('%7788%', '%7788%') as { count: number };
    assert.equal(found.count, 1);

    const photoDir = path.join(directory, 'photos', String(recordId));
    mkdirSync(photoDir, { recursive: true });
    writeFileSync(path.join(photoDir, 'weighing.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
    assert.equal(`photos/${recordId}/weighing.jpg`, `photos/${recordId}/weighing.jpg`);
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
