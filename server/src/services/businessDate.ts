/** SQLite timestamps are UTC; the warehouse's business date is UTC+08:00. */
export const BUSINESS_TIMEZONE = 'UTC+08:00';

export function businessDateSql(column: string) {
  return `date(datetime(${column}, '+8 hours'))`;
}
