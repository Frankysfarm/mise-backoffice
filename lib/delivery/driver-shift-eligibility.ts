export const DEFAULT_DRIVER_SESSION_MAX_HOURS = 16;
export const DEFAULT_DRIVER_SHIFT_CUTOFF_MINUTE = 0;

function berlinCalendarParts(value: Date): { date: string; minuteOfDay: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(entry => entry.type === type)?.value ?? '';
  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    minuteOfDay: Number(part('hour')) * 60 + Number(part('minute')),
  };
}

function previousIsoDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
}

export function berlinDriverWorkday(
  value: Date,
  cutoffMinute = DEFAULT_DRIVER_SHIFT_CUTOFF_MINUTE,
): string {
  const safeCutoff = Number.isFinite(cutoffMinute)
    ? Math.min(1439, Math.max(0, Math.trunc(cutoffMinute)))
    : DEFAULT_DRIVER_SHIFT_CUTOFF_MINUTE;
  const local = berlinCalendarParts(value);
  return local.minuteOfDay < safeCutoff ? previousIsoDate(local.date) : local.date;
}

/** A driver online flag is leased for the current configurable Berlin workday. */
export function hasCurrentDriverSession(
  shiftStartedAt: string | null | undefined,
  now = new Date(),
  cutoffMinute = DEFAULT_DRIVER_SHIFT_CUTOFF_MINUTE,
  maxSessionHours = DEFAULT_DRIVER_SESSION_MAX_HOURS,
): boolean {
  if (!shiftStartedAt) return false;
  const started = new Date(shiftStartedAt);
  const age = now.getTime() - started.getTime();
  const maxAge = Math.min(24, Math.max(1, maxSessionHours)) * 60 * 60 * 1000;
  if (!Number.isFinite(started.getTime()) || age < 0 || age > maxAge) return false;
  return berlinDriverWorkday(started, cutoffMinute) === berlinDriverWorkday(now, cutoffMinute);
}
