import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { config } from '../config/index.js';
import { AppError, asyncHandler } from '../middleware/errorHandler.js';
import { createRecordSchema, parseSchema, photoKindSchema, updateRecordSchema } from '../schemas/express.js';
import {
  clearRecordPhoto,
  createRecord,
  deleteRecord,
  getRecord,
  listRecords,
  listRecordsForExport,
  parseRawText,
  resetRecord,
  setRecordPhoto,
  updateRecord
} from '../services/expressService.js';
import { extensionForMime, persistUploadedPhoto, resolveStoredPhotoPath } from '../services/photoService.js';

export const expressRouter = Router();

const photoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = path.join(config.uploadDir, 'tmp');
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const ext = extensionForMime(file.mimetype);
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    }
  }),
  limits: {
    fileSize: 12 * 1024 * 1024,
    files: 2
  },
  fileFilter: (_req, file, cb) => {
    try {
      extensionForMime(file.mimetype);
      cb(null, true);
    } catch (error) {
      cb(error as Error);
    }
  }
});

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
    ['快递单号', '平台', '平台订单号或买家备注', '原始录入文本', '物品名', '数量', '单位', '称重照', '装箱照', '是否修改', '创建时间', '更新时间']
  ];

  for (const record of records) {
    const items = record.custom_json.items.length ? record.custom_json.items : [{ name: '', quantity: '', unit: '' }];
    for (const item of items) {
      rows.push([
        record.tracking_number,
        record.platform,
        record.platform_order_note,
        record.raw_text,
        item.name,
        item.quantity,
        item.unit,
        record.weighing_photo_export,
        record.packing_photo_export,
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
  res.json({ code: 0, data: updateRecord(id, input), message: 'success' });
}));

expressRouter.post('/:id/reset', asyncHandler(async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  res.json({ code: 0, data: resetRecord(id), message: 'success' });
}));

expressRouter.delete('/:id', asyncHandler(async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  res.json({ code: 0, data: deleteRecord(id), message: 'success' });
}));

expressRouter.post('/:id/photos', photoUpload.fields([
  { name: 'weighing', maxCount: 1 },
  { name: 'packing', maxCount: 1 }
]), asyncHandler(async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  getRecord(id);

  const files = req.files as { [field: string]: Express.Multer.File[] } | undefined;
  const weighing = files?.weighing?.[0];
  const packing = files?.packing?.[0];

  if (!weighing && !packing) {
    throw new AppError(1001, 400, '请至少上传一张称重照或装箱照');
  }

  try {
    if (weighing) {
      const stored = persistUploadedPhoto(id, 'weighing', weighing.path, weighing.mimetype);
      setRecordPhoto(id, 'weighing', stored);
    }
    if (packing) {
      const stored = persistUploadedPhoto(id, 'packing', packing.path, packing.mimetype);
      setRecordPhoto(id, 'packing', stored);
    }
  } catch (error) {
    for (const file of [weighing, packing]) {
      if (file?.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    }
    throw error;
  }

  res.json({ code: 0, data: getRecord(id), message: 'success' });
}));

expressRouter.get('/:id/photos/:kind', asyncHandler(async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const kind = photoKindSchema.parse(req.params.kind);
  const record = getRecord(id);
  const stored = kind === 'weighing' ? record.weighing_photo : record.packing_photo;
  const fullPath = resolveStoredPhotoPath(id, stored);
  if (!fullPath || !fs.existsSync(fullPath)) {
    throw new AppError(1002, 404, '图片不存在');
  }
  res.sendFile(path.resolve(fullPath));
}));

expressRouter.delete('/:id/photos/:kind', asyncHandler(async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const kind = photoKindSchema.parse(req.params.kind);
  res.json({ code: 0, data: clearRecordPhoto(id, kind), message: 'success' });
}));
