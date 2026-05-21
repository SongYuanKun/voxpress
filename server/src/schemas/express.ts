import { z } from 'zod';

export const itemSchema = z.object({
  name: z.string().trim().min(1).max(80),
  quantity: z.number().int().positive().max(999999),
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
  duplicate_confirmed: z.boolean().optional()
});

export const parseSchema = z.object({
  raw_text: z.string().trim().min(1).max(1000)
});

export const updateRecordSchema = z.object({
  custom_json: parsedItemsSchema
});

export type ParsedItems = z.infer<typeof parsedItemsSchema>;
export type ParsedItem = z.infer<typeof itemSchema>;
