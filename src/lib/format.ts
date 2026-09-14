/** Localized date and time (e.g. "Sep 14, 2026, 1:05 AM"), or '' for an invalid timestamp. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
