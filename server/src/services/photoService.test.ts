import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

test('photo helpers store files and build export refs', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'voxpress-photo-'));
  const overrides = {
    UPLOAD_DIR: path.join(directory, 'uploads'),
    TRUST_PROXY: '',
    REVERSE_PROXY: 'false'
  };
  const previous = Object.fromEntries(Object.keys(overrides).map((key) => [key, process.env[key]]));

  try {
    Object.assign(process.env, overrides);
    const {
      extensionForMime,
      persistUploadedPhoto,
      photoExportRef,
      photoPublicRef,
      resolveStoredPhotoPath
    }: typeof import('./photoService.js') = await import(
      new URL('../../dist/services/photoService.js', import.meta.url).href
    );

    assert.equal(extensionForMime('image/png'), '.png');
    assert.throws(() => extensionForMime('application/pdf'));

    const tmp = path.join(directory, 'upload.tmp');
    writeFileSync(tmp, Buffer.from('fake-image'));
    const stored = persistUploadedPhoto(42, 'weighing', tmp, 'image/jpeg', overrides.UPLOAD_DIR);
    assert.equal(stored, 'weighing.jpg');
    const full = resolveStoredPhotoPath(42, stored, overrides.UPLOAD_DIR);
    assert.ok(full && existsSync(full));
    assert.equal(readFileSync(full!).toString(), 'fake-image');
    assert.equal(photoPublicRef(42, 'weighing', stored), '/api/express/42/photos/weighing');
    assert.equal(photoExportRef(42, stored), 'photos/42/weighing.jpg');
    assert.equal(photoExportRef(42, null), '');
  } finally {
    for (const key of Object.keys(overrides)) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
    rmSync(directory, { recursive: true, force: true });
  }
});
