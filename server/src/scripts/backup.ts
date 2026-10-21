import { createDatabaseBackup } from '../services/backupService.js';

createDatabaseBackup()
  .then(({ filePath, recordCount }) => console.log(`backup created: ${filePath} (${recordCount} records)`))
  .catch((error) => {
    console.error('backup failed', error);
    process.exitCode = 1;
  });
