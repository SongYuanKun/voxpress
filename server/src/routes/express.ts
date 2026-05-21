import { Router } from 'express';
import { z } from 'zod';
import { AppError, asyncHandler } from '../middleware/errorHandler.js';
import { createRecordSchema, parseSchema, parsedItemsSchema, updateRecordSchema } from '../schemas/express.js';
import { createRecord, deleteRecord, getRecord, listRecords, listRecordsForExport, parseRawText, resetRecord, updateRecord } from '../services/expressService.js';

export const expressRouter = Router();

expressRouter.post('/parse', asyncHandler(async (req, res) => {
  const input = parseSchema.parse(req.body);
  const parsed = await parseRawText(input.raw_text);
  res.json({ code: 0, data: parsed, message: 'success' });
}));

expressRouter.post('/', asyncHandler(async (req, res) => {
  const input = createRecordSchema.parse(req.body);
  if (input.items && input.items.length === 0) {
    throw new AppError(1001, 400, '物品清单不能为空');
  }
  const record = await createRecord(input);
  res.json({ code: 0, data: record, message: 'success' });
}));

expressRouter.get('/', asyncHandler(async (req, res) => {
  const query = z.object({
    page: z.coerce.number().optional(),
    page_size: z.coerce.number().optional(),
    keyword: z.string().optional(),
    date_from: z.string().optional(),
    date_to: z.string().optional()
  }).parse(req.query);
  res.json({ code: 0, data: listRecords(query), message: 'success' });
}));

function csvCell(value: unknown) {
  let text = String(value ?? '');
  if (/^[=+\-@]/.test(text)) {
    text = `'${text}`;
  }
  return `"${text.replace(/"/g, '""')}"`;
}

expressRouter.get('/export.csv', asyncHandler(async (req, res) => {
  const query = z.object({
    keyword: z.string().optional(),
    date_from: z.string().optional(),
    date_to: z.string().optional()
  }).parse(req.query);

  const records = listRecordsForExport(query);
  const rows: unknown[][] = [
    ['快递单号', '原始录入文本', '物品名', '数量', '单位', '是否修改', '创建时间', '更新时间']
  ];

  for (const record of records) {
    const items = record.custom_json.items.length ? record.custom_json.items : [{ name: '', quantity: '', unit: '' }];
    for (const item of items) {
      rows.push([
        record.tracking_number,
        record.raw_text,
        item.name,
        item.quantity,
        item.unit,
        record.is_modified ? '是' : '否',
        record.created_at,
        record.updated_at
      ]);
    }
  }

  const csv = '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\n');
  const filename = `voxpress-export-${new Date().toISOString().slice(0, 10)}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}));

expressRouter.get('/:id', asyncHandler(async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  res.json({ code: 0, data: getRecord(id), message: 'success' });
}));

expressRouter.patch('/:id', asyncHandler(async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const input = updateRecordSchema.parse(req.body);
  res.json({ code: 0, data: updateRecord(id, input.custom_json), message: 'success' });
}));

expressRouter.post('/:id/reset', asyncHandler(async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  res.json({ code: 0, data: resetRecord(id), message: 'success' });
}));

expressRouter.delete('/:id', asyncHandler(async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  res.json({ code: 0, data: deleteRecord(id), message: 'success' });
}));
