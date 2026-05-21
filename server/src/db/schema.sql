PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS express_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_request_id TEXT UNIQUE NOT NULL,
  tracking_number TEXT NOT NULL,
  raw_text TEXT NOT NULL,
  original_json TEXT NOT NULL,
  custom_json TEXT NOT NULL,
  source_type TEXT DEFAULT 'manual',
  sync_status TEXT DEFAULT 'synced',
  status INTEGER DEFAULT 1,
  created_by TEXT,
  deleted_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tracking_number ON express_records(tracking_number);
CREATE INDEX IF NOT EXISTS idx_status_created ON express_records(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_status ON express_records(sync_status);

CREATE TABLE IF NOT EXISTS express_record_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  record_id INTEGER NOT NULL,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit TEXT DEFAULT '',
  is_original INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(record_id) REFERENCES express_records(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_item_name ON express_record_items(item_name);
CREATE INDEX IF NOT EXISTS idx_record_id ON express_record_items(record_id);

CREATE TABLE IF NOT EXISTS backup_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_path TEXT NOT NULL,
  record_count INTEGER DEFAULT 0,
  file_size TEXT DEFAULT '0B',
  status INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

