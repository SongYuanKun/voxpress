import { z } from 'zod';

/** Positive finite quantity; integers and decimals (e.g. 12.5) both allowed. */
export const quantitySchema = z
  .number({ invalid_type_error: '数量必须是数字' })
  .finite()
  .positive()
  .max(999999)
  .transform((value) => Number(value.toFixed(4)));

export const platformValues = ['', '闲鱼', '微店', '小红书', '其他'] as const;
export const platformSchema = z.enum(platformValues).default('');

export const itemSchema = z.object({
  name: z.string().trim().min(1).max(80),
  quantity: quantitySchema,
  unit: z.string().trim().max(16).default('')
});

export const parsedItemsSchema = z.object({
  items: z.array(itemSchema).max(100).default([])
});

export const createRecordSchema = z.object({
  client_request_id: z.string().trim().min(8).max(120),
  tracking_number: z.string().trim().min(3).max(80),
  raw_text: z.string().trim().min(1).max(1000),
  items: z.array(itemSchema).min(1).optional(),
  platform: platformSchema.optional(),
  platform_order_note: z.string().trim().max(200).default('').optional(),
  duplicate_confirmed: z.boolean().optional()
});

export const parseSchema = z.object({
  raw_text: z.string().trim().min(1).max(1000)
});

export const updateRecordSchema = z.object({
  custom_json: parsedItemsSchema.optional(),
  platform: platformSchema.optional(),
  platform_order_note: z.string().trim().max(200).optional()
}).refine(
  (value) => value.custom_json !== undefined || value.platform !== undefined || value.platform_order_note !== undefined,
  { message: '至少提供一项待更新字段' }
);

export const photoKindSchema = z.enum(['weighing', 'packing']);

export type ParsedItems = z.infer<typeof parsedItemsSchema>;
export type ParsedItem = z.infer<typeof itemSchema>;
export type Platform = z.infer<typeof platformSchema>;
export type PhotoKind = z.infer<typeof photoKindSchema>;
