/** Local-timezone date math shared by aggregations and block windows. */

const HOUR_MS = 60 * 60 * 1000;

/** Floor a date to the top of its hour (local time). */
export function floorToHour(date: Date): Date {
  const floored = new Date(date.getTime());
  floored.setMinutes(0, 0, 0);
  return floored;
}

/** Start of the local calendar day containing `date`. */
export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Start of the local calendar month containing `date`. */
export function startOfLocalMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** Local `YYYY-MM-DD` key for day-bucketing. */
export function localDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export { HOUR_MS };
