import { randomUUID } from 'node:crypto';
import { db } from '../db/index.js';
import { AppError } from '../middleware/errorHandler.js';
import type { ParsedItem, ParsedItems } from '../schemas/express.js';
import { parseItems } from './llmService.js';

type RecordRow = {
  id: number;
  client_request_id: string;
  tracking_number: string;
  raw_text: string;
  original_json: string;
  custom_json: string;
  source_type: string | null;
  sync_status: string | null;
  status: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

function toJson(items: ParsedItems) {
  return JSON.stringify(items);
}

function parseJson(value: string): ParsedItems {
  return JSON.parse(value) as ParsedItems;
}

function isModified(row: RecordRow) {
  return row.original_json !== row.custom_json;
}

function mapRecord(row: RecordRow) {
  const original = parseJson(row.original_json);
  const custom = parseJson(row.custom_json);
  return {
    id: row.id,
    client_request_id: row.client_request_id,
    tracking_number: row.tracking_number,
    raw_text: row.raw_text,
    original_json: original,
    custom_json: custom,
    source_type: row.source_type,
    sync_status: row.sync_status,
    status: row.status,
    is_modified: isModified(row),
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at
  };
}

function insertItems(recordId: number, items: ParsedItem[], isOriginal: number) {
  const insert = db.prepare(
    'INSERT INTO express_record_items (record_id, item_name, quantity, unit, is_original) VALUES (?, ?, ?, ?, ?)'
  );

  const tx = db.transaction(() => {
    for (const item of items) {
      insert.run(recordId, item.name, item.quantity, item.unit || '', isOriginal);
    }
  });
  tx();
}

function replaceCustomItems(recordId: number, items: ParsedItem[]) {
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM express_record_items WHERE record_id = ? AND is_original = 0').run(recordId);
    insertItems(recordId, items, 0);
  });
  tx();
}

export async function parseRawText(rawText: string) {
  return parseItems(rawText);
}

export async function createRecord(input: {
  client_request_id?: string;
  tracking_number: string;
  raw_text: string;
  items?: ParsedItem[];
  duplicate_confirmed?: boolean;
}) {
  const existingByRequest = db.prepare('SELECT * FROM express_records WHERE client_request_id = ?').get(
    input.client_request_id
  ) as RecordRow | undefined;

  if (existingByRequest) {
    return mapRecord(existingByRequest);
  }

  const duplicate = db.prepare('SELECT id, tracking_number FROM express_records WHERE tracking_number = ? AND status = 1 LIMIT 1').get(
    input.tracking_number
  );

  if (duplicate && !input.duplicate_confirmed) {
    throw new AppError(1008, 409, '快递单号已存在', duplicate);
  }

  const parsed = input.items ? { items: input.items } : await parseItems(input.raw_text);
  const payload = toJson(parsed);
  const clientRequestId = input.client_request_id || randomUUID();

  const tx = db.transaction(() => {
    const result = db.prepare(
      `INSERT INTO express_records
       (client_request_id, tracking_number, raw_text, original_json, custom_json)
       VALUES (?, ?, ?, ?, ?)`
    ).run(clientRequestId, input.tracking_number, input.raw_text, payload, payload);

    const recordId = Number(result.lastInsertRowid);
    insertItems(recordId, parsed.items, 1);
    insertItems(recordId, parsed.items, 0);
    return recordId;
  });

  const id = tx();
  return getRecord(id);
}

export function listRecords(query: {
  page?: number;
  page_size?: number;
  keyword?: string;
  date_from?: string;
  date_to?: string;
}) {
  const page = Math.max(1, query.page || 1);
  const pageSize = Math.min(100, Math.max(1, query.page_size || 20));
  const where: string[] = ['r.status = 1'];
  const params: unknown[] = [];

  if (query.date_from) {
    where.push('date(r.created_at) >= date(?)');
    params.push(query.date_from);
  }

  if (query.date_to) {
    where.push('date(r.created_at) <= date(?)');
    params.push(query.date_to);
  }

  if (query.keyword) {
    where.push(`(r.tracking_number LIKE ? OR EXISTS (
      SELECT 1 FROM express_record_items i
      WHERE i.record_id = r.id AND i.item_name LIKE ? AND i.is_original = 0
    ))`);
    params.push(`%${query.keyword}%`, `%${query.keyword}%`);
  }

  const whereSql = where.join(' AND ');
  const total = (db.prepare(`SELECT COUNT(*) as count FROM express_records r WHERE ${whereSql}`).get(...params) as { count: number }).count;
  const rows = db.prepare(`SELECT r.* FROM express_records r WHERE ${whereSql} ORDER BY r.created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, pageSize, (page - 1) * pageSize) as RecordRow[];

  return {
    list: rows.map(mapRecord),
    total,
    page,
    page_size: pageSize
  };
}

export function listRecordsForExport(query: {
  keyword?: string;
  date_from?: string;
  date_to?: string;
}) {
  const where: string[] = ['r.status = 1'];
  const params: unknown[] = [];

  if (query.date_from) {
    where.push('date(r.created_at) >= date(?)');
    params.push(query.date_from);
  }

  if (query.date_to) {
    where.push('date(r.created_at) <= date(?)');
    params.push(query.date_to);
  }

  if (query.keyword) {
    where.push(`(r.tracking_number LIKE ? OR EXISTS (
      SELECT 1 FROM express_record_items i
      WHERE i.record_id = r.id AND i.item_name LIKE ? AND i.is_original = 0
    ))`);
    params.push(`%${query.keyword}%`, `%${query.keyword}%`);
  }

  const rows = db.prepare(`SELECT r.* FROM express_records r WHERE ${where.join(' AND ')} ORDER BY r.created_at DESC LIMIT 10000`)
    .all(...params) as RecordRow[];
  return rows.map(mapRecord);
}

export function getRecord(id: number) {
  const row = db.prepare('SELECT * FROM express_records WHERE id = ? AND status = 1').get(id) as RecordRow | undefined;
  if (!row) throw new AppError(1002, 404, '记录不存在');
  return mapRecord(row);
}

export function updateRecord(id: number, customJson: ParsedItems) {
  getRecord(id);
  db.prepare('UPDATE express_records SET custom_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
    toJson(customJson),
    id
  );
  replaceCustomItems(id, customJson.items);
  return getRecord(id);
}

export function resetRecord(id: number) {
  const record = getRecord(id);
  db.prepare('UPDATE express_records SET custom_json = original_json, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
  replaceCustomItems(id, record.original_json.items);
  return getRecord(id);
}

export function deleteRecord(id: number) {
  getRecord(id);
  db.prepare('UPDATE express_records SET status = 0, deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
  return { id, status: 0 };
}
