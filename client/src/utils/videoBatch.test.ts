import assert from 'node:assert/strict';
import test from 'node:test';
import { savePendingVideoRecords } from './videoBatch.ts';

test('a batch retry skips records that were saved before another record failed', async () => {
  const first = { id: 'first' };
  const second = { id: 'second' };
  const savedRecords = new WeakSet<object>();
  const calls = new Map<string, number>();
  const save = async (record: { id: string }) => {
    calls.set(record.id, (calls.get(record.id) || 0) + 1);
    if (record.id === 'second' && calls.get(record.id) === 1) throw new Error('network failed');
    return 'saved' as const;
  };

  assert.deepEqual(await savePendingVideoRecords([first, second], savedRecords, save), {
    saved: 1, failed: 1, cancelled: 0, skipped: 0
  });
  assert.deepEqual(await savePendingVideoRecords([first, second], savedRecords, save), {
    saved: 1, failed: 0, cancelled: 0, skipped: 1
  });
  assert.deepEqual(Object.fromEntries(calls), { first: 1, second: 2 });
});

test('a cancelled duplicate confirmation is not marked as saved', async () => {
  const record = { id: 'duplicate' };
  const savedRecords = new WeakSet<object>();
  const summary = await savePendingVideoRecords([record], savedRecords, async () => 'cancelled');
  assert.deepEqual(summary, { saved: 0, failed: 0, cancelled: 1, skipped: 0 });
  assert.equal(savedRecords.has(record), false);
});
