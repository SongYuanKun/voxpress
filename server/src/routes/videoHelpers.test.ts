import assert from 'node:assert/strict';
import test from 'node:test';
import { extractTrackingCandidates, recordsFromCandidates } from './videoHelpers.ts';

test('extracts a tracking candidate after the evidence display limit', () => {
  const result = extractTrackingCandidates(['x'.repeat(350), 'SF1234567890123']);
  assert.equal(result.evidence.length, 300);
  assert.deepEqual(result.candidates.map((candidate) => candidate.tracking_number), ['SF1234567890123']);
});

test('fallback retains the complete transcript for manual confirmation', () => {
  const records = recordsFromCandidates([{ tracking_number: 'YT1234567890123', confidence: 0.72, evidence: 'OCR' }], '完整口述');
  assert.equal(records[0].raw_text, '完整口述');
});
