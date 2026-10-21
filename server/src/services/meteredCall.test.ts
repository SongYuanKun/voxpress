import assert from 'node:assert/strict';
import test from 'node:test';
import { runMeteredCall } from './meteredCall.ts';

test('a rejected quota prevents the fake provider from being called', async () => {
  let outboundCalls = 0;
  await assert.rejects(
    runMeteredCall(
      () => { throw new Error('quota exhausted'); },
      async () => {
        outboundCalls += 1;
        return 'provider result';
      }
    ),
    /quota exhausted/
  );
  assert.equal(outboundCalls, 0);
});
