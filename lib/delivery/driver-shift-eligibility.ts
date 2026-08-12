const MAX_DRIVER_SESSION_MS = 16 * 60 * 60 * 1000;

function berlinCalendarDate(value: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(entry => entry.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** A driver online flag is leased for the current Berlin workday. */
export function hasCurrentDriverSession(
  shiftStartedAt: string | null | undefined,
  now = new Date(),
): boolean {
  if (!shiftStartedAt) return false;
  const started = new Date(shiftStartedAt);
  const age = now.getTime() - started.getTime();
  if (!Number.isFinite(started.getTime()) || age < 0 || age > MAX_DRIVER_SESSION_MS) return false;
  return berlinCalendarDate(started) === berlinCalendarDate(now);
}
