import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config/index.js';
import { db } from '../db/index.js';

function backupName(now: Date) {
  return `voxpress-${now.toISOString().replace(/[:.]/g, '-')}.db`;
}

async function pruneExpiredBackups(now: Date) {
  const expiry = now.getTime() - config.backup.retentionDays * 24 * 60 * 60 * 1000;
  const entries = await fs.readdir(config.backup.dir, { withFileTypes: true });
  await Promise.all(entries.filter((entry) => entry.isFile() && /^voxpress-.*\.db$/.test(entry.name)).map(async (entry) => {
    const filePath = path.join(config.backup.dir, entry.name);
    const stat = await fs.stat(filePath);
    if (stat.mtimeMs < expiry) await fs.unlink(filePath);
  }));
}

/** Creates one SQLite-consistent backup when explicitly invoked; it schedules nothing. */
export async function createDatabaseBackup(now = new Date()) {
  await fs.mkdir(config.backup.dir, { recursive: true });
  const filePath = path.join(config.backup.dir, backupName(now));
  await db.backup(filePath);
  const [stat, count] = await Promise.all([
    fs.stat(filePath),
    Promise.resolve((db.prepare('SELECT COUNT(*) AS count FROM express_records').get() as { count: number }).count)
  ]);
  db.prepare('INSERT INTO backup_logs (file_path, record_count, file_size) VALUES (?, ?, ?)')
    .run(filePath, count, `${stat.size}B`);
  await pruneExpiredBackups(now);
  return { filePath, recordCount: count, bytes: stat.size };
}
