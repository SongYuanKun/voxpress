import assert from 'node:assert/strict';
import test from 'node:test';
import { createRecordSchema, itemSchema, quantitySchema, updateRecordSchema } from './express.ts';

test('quantity accepts positive decimals and trims to 4 places', () => {
  assert.equal(quantitySchema.parse(12.5), 12.5);
  assert.equal(quantitySchema.parse(3.2), 3.2);
  assert.equal(quantitySchema.parse(1), 1);
  assert.equal(quantitySchema.parse(0.12345), 0.1235);
});

test('quantity rejects zero, negative, and non-finite values', () => {
  assert.throws(() => quantitySchema.parse(0));
  assert.throws(() => quantitySchema.parse(-1));
  assert.throws(() => quantitySchema.parse(Number.NaN));
  assert.throws(() => quantitySchema.parse(Number.POSITIVE_INFINITY));
});

test('itemSchema accepts decimal quantity with unit 克', () => {
  const item = itemSchema.parse({ name: '黄金', quantity: 12.5, unit: '克' });
  assert.deepEqual(item, { name: '黄金', quantity: 12.5, unit: '克' });
});

test('createRecordSchema accepts platform fields', () => {
  const parsed = createRecordSchema.parse({
    client_request_id: 'client-req-001',
    tracking_number: 'SF1234567890',
    raw_text: '黄金 12.5 克',
    items: [{ name: '黄金', quantity: 12.5, unit: '克' }],
    platform: '闲鱼',
    platform_order_note: '订单ABC123'
  });
  assert.equal(parsed.platform, '闲鱼');
  assert.equal(parsed.platform_order_note, '订单ABC123');
  assert.equal(parsed.items?.[0].quantity, 12.5);
});

test('updateRecordSchema allows platform-only updates', () => {
  const parsed = updateRecordSchema.parse({
    platform: '微店',
    platform_order_note: '买家：张三'
  });
  assert.equal(parsed.platform, '微店');
  assert.equal(parsed.custom_json, undefined);
});

test('updateRecordSchema rejects empty patch', () => {
  assert.throws(() => updateRecordSchema.parse({}));
});
