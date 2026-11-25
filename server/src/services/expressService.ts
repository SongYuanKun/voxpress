import { randomUUID } from 'node:crypto';
import { db } from '../db/index.js';
import { AppError } from '../middleware/errorHandler.js';
import type { ParsedItem, ParsedItems, PhotoKind, Platform } from '../schemas/express.js';
import { parseItems } from './llmService.js';
import { businessDateSql } from './businessDate.js';
import { deletePhotoFile, photoExportRef, photoPublicRef } from './photoService.js';

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
  platform: string | null;
  platform_order_note: string | null;
  weighing_photo: string | null;
  packing_photo: string | null;
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
    platform: row.platform || '',
    platform_order_note: row.platform_order_note || '',
    weighing_photo: row.weighing_photo,
    packing_photo: row.packing_photo,
    weighing_photo_url: photoPublicRef(row.id, 'weighing', row.weighing_photo),
    packing_photo_url: photoPublicRef(row.id, 'packing', row.packing_photo),
    weighing_photo_export: photoExportRef(row.id, row.weighing_photo),
    packing_photo_export: photoExportRef(row.id, row.packing_photo),
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
  platform?: Platform | string;
  platform_order_note?: string;
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
  const platform = input.platform || '';
  const platformOrderNote = input.platform_order_note || '';

  const tx = db.transaction(() => {
    const result = db.prepare(
      `INSERT INTO express_records
       (client_request_id, tracking_number, raw_text, original_json, custom_json, platform, platform_order_note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(clientRequestId, input.tracking_number, input.raw_text, payload, payload, platform, platformOrderNote);

    const recordId = Number(result.lastInsertRowid);
    insertItems(recordId, parsed.items, 1);
    insertItems(recordId, parsed.items, 0);
    return recordId;
  });

  const id = tx();
  return getRecord(id);
}

function buildListWhere(query: {
  keyword?: string;
  date_from?: string;
  date_to?: string;
}) {
  const where: string[] = ['r.status = 1'];
  const params: unknown[] = [];

  if (query.date_from) {
    where.push(`${businessDateSql('r.created_at')} >= date(?)`);
    params.push(query.date_from);
  }

  if (query.date_to) {
    where.push(`${businessDateSql('r.created_at')} <= date(?)`);
    params.push(query.date_to);
  }

  if (query.keyword) {
    where.push(`(
      r.tracking_number LIKE ?
      OR IFNULL(r.platform_order_note, '') LIKE ?
      OR IFNULL(r.platform, '') LIKE ?
      OR EXISTS (
        SELECT 1 FROM express_record_items i
        WHERE i.record_id = r.id AND i.item_name LIKE ? AND i.is_original = 0
      )
    )`);
    const like = `%${query.keyword}%`;
    params.push(like, like, like, like);
  }

  return { whereSql: where.join(' AND '), params };
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
  const { whereSql, params } = buildListWhere(query);

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
  const { whereSql, params } = buildListWhere(query);
  const rows = db.prepare(`SELECT r.* FROM express_records r WHERE ${whereSql} ORDER BY r.created_at DESC LIMIT 10000`)
    .all(...params) as RecordRow[];
  return rows.map(mapRecord);
}

export function getRecord(id: number) {
  const row = db.prepare('SELECT * FROM express_records WHERE id = ? AND status = 1').get(id) as RecordRow | undefined;
  if (!row) throw new AppError(1002, 404, '记录不存在');
  return mapRecord(row);
}

export function updateRecord(id: number, patch: {
  custom_json?: ParsedItems;
  platform?: string;
  platform_order_note?: string;
}) {
  const current = getRecord(id);
  const fields: string[] = [];
  const values: unknown[] = [];

  if (patch.custom_json) {
    fields.push('custom_json = ?');
    values.push(toJson(patch.custom_json));
  }
  if (patch.platform !== undefined) {
    fields.push('platform = ?');
    values.push(patch.platform);
  }
  if (patch.platform_order_note !== undefined) {
    fields.push('platform_order_note = ?');
    values.push(patch.platform_order_note);
  }

  if (!fields.length) {
    return current;
  }

  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);
  db.prepare(`UPDATE express_records SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  if (patch.custom_json) {
    replaceCustomItems(id, patch.custom_json.items);
  }
  return getRecord(id);
}

export function setRecordPhoto(id: number, kind: PhotoKind, storedName: string) {
  getRecord(id);
  const column = kind === 'weighing' ? 'weighing_photo' : 'packing_photo';
  db.prepare(`UPDATE express_records SET ${column} = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(storedName, id);
  return getRecord(id);
}

export function clearRecordPhoto(id: number, kind: PhotoKind) {
  const record = getRecord(id);
  const column = kind === 'weighing' ? 'weighing_photo' : 'packing_photo';
  const existing = kind === 'weighing' ? record.weighing_photo : record.packing_photo;
  deletePhotoFile(id, existing);
  db.prepare(`UPDATE express_records SET ${column} = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(id);
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
