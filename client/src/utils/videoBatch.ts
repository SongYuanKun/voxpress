export type VideoSaveOutcome = 'saved' | 'cancelled';

export type VideoBatchSummary = {
  saved: number;
  failed: number;
  cancelled: number;
  skipped: number;
};

/** Saves only records not already known to have reached the server. */
export async function savePendingVideoRecords<T extends object>(
  records: readonly T[],
  savedRecords: WeakSet<T>,
  save: (record: T) => Promise<VideoSaveOutcome>
): Promise<VideoBatchSummary> {
  const summary: VideoBatchSummary = { saved: 0, failed: 0, cancelled: 0, skipped: 0 };
  for (const record of records) {
    if (savedRecords.has(record)) {
      summary.skipped += 1;
      continue;
    }
    try {
      const outcome = await save(record);
      if (outcome === 'saved') {
        savedRecords.add(record);
        summary.saved += 1;
      } else {
        summary.cancelled += 1;
      }
    } catch {
      summary.failed += 1;
    }
  }
  return summary;
}
