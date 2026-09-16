/**
 * Shared rolling date window used by both the weather archive fetch and the
 * synthetic sample-data generator, so the two always stay aligned on the
 * same "most recent N days" period instead of a hardcoded historical range.
 */

export const SAMPLE_WINDOW_DAYS = 365
const ARCHIVE_DELAY_DAYS = 2 // Open-Meteo archive data lags ~2 days behind today

export function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function getRollingArchiveRange(windowDays: number = SAMPLE_WINDOW_DAYS): {
  startDate: string
  endDate: string
} {
  const end = new Date(Date.now() - ARCHIVE_DELAY_DAYS * 86_400_000)
  const start = new Date(end.getTime() - (windowDays - 1) * 86_400_000)
  return { startDate: fmtDate(start), endDate: fmtDate(end) }
}
