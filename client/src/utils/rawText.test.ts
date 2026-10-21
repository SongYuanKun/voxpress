import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_RAW_TEXT_CHARS, validateRawText } from './rawText.ts';

test('raw text accepts 1 through 1000 trimmed characters and rejects other lengths', () => {
  assert.deepEqual(validateRawText('  原文  '), { valid: true, value: '原文' });
  assert.equal(validateRawText('   ').valid, false);
  assert.equal(validateRawText('x'.repeat(MAX_RAW_TEXT_CHARS)).valid, true);
  assert.equal(validateRawText('x'.repeat(MAX_RAW_TEXT_CHARS + 1)).valid, false);
});
