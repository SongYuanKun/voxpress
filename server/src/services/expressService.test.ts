import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import http, { type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import express from 'express';

test('record writes remain consistent across concurrent requests and database failures', async (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), 'voxpress-records-'));
  const pending: ServerResponse[] = [];
  const provider = http.createServer((request, response) => {
    request.resume();
    pending.push(response);
    // Release both requests together so each has passed the pre-provider checks.
    if (pending.length === 2) {
      for (const result of pending.splice(0)) {
        result.setHeader('Content-Type', 'application/json');
        result.end(JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ items: [{ name: 'fixture', quantity: 1, unit: '' }] }) } }]
        }));
      }
    }
  });
  await new Promise<void>(resolve => provider.listen(0, '127.0.0.1', resolve));
  const overrides = {
    NODE_ENV: 'test',
    DB_PATH: path.join(directory, 'records.db'),
    LLM_API_KEY: 'test-fixture-key',
    LLM_API_BASE: `http://127.0.0.1:${(provider.address() as AddressInfo).port}/v1`,
    LLM_DAILY_LIMIT: '100',
    LLM_TIMEOUT_MS: '2000',
    ASR_API_KEY: '',
    ASR_API_BASE: 'http://127.0.0.1:1',
    TRUST_PROXY: '',
    REVERSE_PROXY: 'false',
    LOG_LEVEL: 'silent'
  };
  const previous = Object.fromEntries(Object.keys(overrides).map(key => [key, process.env[key]]));
  Object.assign(process.env, overrides);
  let database: typeof import('../db/index.js').db | undefined;
  let api: http.Server | undefined;
  try {
    const { db }: typeof import('../db/index.js') = await import(new URL('../../dist/db/index.js', import.meta.url).href);
    database = db;
    const service: typeof import('./expressService.js') = await import(new URL('../../dist/services/expressService.js', import.meta.url).href);

    await t.test('concurrent retries of one request return the same saved record', async () => {
      const input = { client_request_id: 'concurrent-request', tracking_number: 'RETRY123', raw_text: 'fixture' };
      const results = await Promise.all([service.createRecord(input), service.createRecord(input)]);
      assert.equal(results[0].id, results[1].id);
      assert.equal(service.listRecords({ keyword: 'RETRY123' }).total, 1);
    });

    await t.test('concurrent new requests cannot bypass duplicate confirmation', async () => {
      const results = await Promise.allSettled([
        service.createRecord({ client_request_id: 'duplicate-one', tracking_number: 'DUPLICATE123', raw_text: 'fixture' }),
        service.createRecord({ client_request_id: 'duplicate-two', tracking_number: 'DUPLICATE123', raw_text: 'fixture' })
      ]);
      assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
      const rejected = results.find(result => result.status === 'rejected');
      assert.equal(rejected?.reason.code, 1008);
      assert.equal(rejected?.reason.status, 409);
      assert.equal(service.listRecords({ keyword: 'DUPLICATE123' }).total, 1);
      const confirmed = await service.createRecord({
        client_request_id: 'duplicate-confirmed', tracking_number: 'DUPLICATE123', raw_text: 'fixture',
        items: [{ name: 'confirmed', quantity: 1, unit: '' }], duplicate_confirmed: true
      });
      assert.equal(confirmed.tracking_number, 'DUPLICATE123');
      assert.equal(service.listRecords({ keyword: 'DUPLICATE123' }).total, 2);
    });

    await t.test('an item-index failure rolls back the edited record', async () => {
      const record = await service.createRecord({
        client_request_id: 'update-failure', tracking_number: 'UPDATE123', raw_text: 'fixture',
        items: [{ name: 'original', quantity: 1, unit: '' }]
      });
      db.exec("CREATE TRIGGER fail_update BEFORE INSERT ON express_record_items WHEN NEW.item_name = 'broken' BEGIN SELECT RAISE(ABORT, 'fixture item write failure'); END");
      try {
        assert.throws(() => service.updateRecord(record.id, { items: [{ name: 'broken', quantity: 2, unit: '' }] }), /fixture item write failure/);
        assert.deepEqual(service.getRecord(record.id).custom_json, record.custom_json);
        assert.equal(service.listRecords({ keyword: 'original' }).total, 1);
        assert.equal(service.listRecords({ keyword: 'broken' }).total, 0);
      } finally {
        db.exec('DROP TRIGGER fail_update');
      }
    });

    await t.test('an item-index failure rolls back a reset', async () => {
      const record = await service.createRecord({
        client_request_id: 'reset-failure', tracking_number: 'RESET123', raw_text: 'fixture',
        items: [{ name: 'initial', quantity: 1, unit: '' }]
      });
      const edited = service.updateRecord(record.id, { items: [{ name: 'edited', quantity: 2, unit: '' }] });
      db.exec("CREATE TRIGGER fail_reset BEFORE INSERT ON express_record_items WHEN NEW.item_name = 'initial' AND NEW.is_original = 0 BEGIN SELECT RAISE(ABORT, 'fixture reset failure'); END");
      try {
        assert.throws(() => service.resetRecord(record.id), /fixture reset failure/);
        assert.deepEqual(service.getRecord(record.id).custom_json, edited.custom_json);
        assert.equal(service.listRecords({ keyword: 'edited' }).total, 1);
        assert.equal(service.listRecords({ keyword: 'initial' }).total, 0);
      } finally {
        db.exec('DROP TRIGGER fail_reset');
      }
      assert.deepEqual(service.resetRecord(record.id).custom_json, record.original_json);
    });

    await t.test('the list API rejects invalid pagination with a client error', async () => {
      const { expressRouter }: typeof import('../routes/express.js') = await import(new URL('../../dist/routes/express.js', import.meta.url).href);
      const { errorHandler }: typeof import('../middleware/errorHandler.js') = await import(new URL('../../dist/middleware/errorHandler.js', import.meta.url).href);
      const app = express();
      app.use('/api/express', expressRouter);
      app.use(errorHandler);
      api = http.createServer(app);
      await new Promise<void>(resolve => api!.listen(0, '127.0.0.1', resolve));
      const base = `http://127.0.0.1:${(api.address() as AddressInfo).port}/api/express`;
      for (const query of ['page=1.5', 'page_size=1.5', 'page=Infinity', 'page_size=Infinity', 'page=0', 'page_size=-1',
        'page=1e20', 'page_size=1e20', 'page=9007199254740992', 'page_size=9007199254740992']) {
        const response = await fetch(`${base}?${query}`);
        assert.equal(response.status, 400, query);
        assert.equal((await response.json() as { code: number }).code, 1001);
      }
      const response = await fetch(`${base}?page=1&page_size=2`);
      assert.equal(response.status, 200);
      const body = await response.json() as { data: { page: number; page_size: number; list: unknown[] } };
      assert.equal(body.data.page, 1);
      assert.equal(body.data.page_size, 2);
      assert.equal(body.data.list.length, 2);
    });
  } finally {
    if (api) await new Promise<void>(resolve => api!.close(() => resolve()));
    provider.closeAllConnections();
    await new Promise<void>(resolve => provider.close(() => resolve()));
    database?.close();
    for (const key of Object.keys(overrides)) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
    rmSync(directory, { recursive: true, force: true });
  }
});
