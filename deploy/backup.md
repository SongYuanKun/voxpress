# VoxPress SQLite Backup

MVP uses SQLite with WAL enabled. Do not copy the database file while writes are active unless WAL is handled.

Recommended backup options:

1. Use SQLite backup API in a future backup service.
2. Use `VACUUM INTO '/app/backups/express-YYYYMMDD.db'` during low traffic.
3. Keep at least the latest 7 daily backups.

Container volumes:

- `./data:/app/data`
- `./backups:/app/backups`

