import type Database from 'better-sqlite3';

type ColumnInfo = {
  name: string;
  type: string;
};

function tableColumns(db: Database.Database, table: string): ColumnInfo[] {
  return db.pragma(`table_info(${table})`) as ColumnInfo[];
}

function hasColumn(columns: ColumnInfo[], name: string) {
  return columns.some((column) => column.name === name);
}

function ensureRecordColumns(db: Database.Database) {
  const columns = tableColumns(db, 'express_records');
  const additions: Array<{ name: string; ddl: string }> = [
    { name: 'platform', ddl: "ALTER TABLE express_records ADD COLUMN platform TEXT DEFAULT ''" },
    { name: 'platform_order_note', ddl: "ALTER TABLE express_records ADD COLUMN platform_order_note TEXT DEFAULT ''" },
    { name: 'weighing_photo', ddl: 'ALTER TABLE express_records ADD COLUMN weighing_photo TEXT' },
    { name: 'packing_photo', ddl: 'ALTER TABLE express_records ADD COLUMN packing_photo TEXT' }
  ];

  for (const addition of additions) {
    if (!hasColumn(columns, addition.name)) {
      db.exec(addition.ddl);
    }
  }
}

function quantityNeedsRealMigration(db: Database.Database) {
  const columns = tableColumns(db, 'express_record_items');
  const quantity = columns.find((column) => column.name === 'quantity');
  if (!quantity) return false;
  return quantity.type.toUpperCase() !== 'REAL';
}

function migrateQuantityToReal(db: Database.Database) {
  if (!quantityNeedsRealMigration(db)) return;

  const migrate = db.transaction(() => {
    db.exec('DROP TABLE IF EXISTS express_record_items_new');
    db.exec(`
      CREATE TABLE express_record_items_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        record_id INTEGER NOT NULL,
        item_name TEXT NOT NULL,
        quantity REAL NOT NULL,
        unit TEXT DEFAULT '',
        is_original INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(record_id) REFERENCES express_records(id) ON DELETE CASCADE
      );
    `);
    db.exec(`
      INSERT INTO express_record_items_new (id, record_id, item_name, quantity, unit, is_original, created_at)
        SELECT id, record_id, item_name, CAST(quantity AS REAL), unit, is_original, created_at
        FROM express_record_items;
    `);
    db.exec('DROP TABLE express_record_items');
    db.exec('ALTER TABLE express_record_items_new RENAME TO express_record_items');
    db.exec('CREATE INDEX IF NOT EXISTS idx_item_name ON express_record_items(item_name)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_record_id ON express_record_items(record_id)');
  });

  migrate();
}

export function runMigrations(db: Database.Database) {
  ensureRecordColumns(db);
  migrateQuantityToReal(db);
  db.exec('CREATE INDEX IF NOT EXISTS idx_platform_order_note ON express_records(platform_order_note)');
}
