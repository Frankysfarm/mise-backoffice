export type ShiftTiming = 'upcoming' | 'active' | 'completed';

export type WorkforceShift = {
  start_zeit: string;
  end_zeit: string;
  pause_minuten?: number | null;
};

const BERLIN_DATE_PARTS = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function berlinDateParts(value: Date): { year: number; month: number; day: number } {
  const parts = Object.fromEntries(
    BERLIN_DATE_PARTS.formatToParts(value)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  );
  return { year: parts.year, month: parts.month, day: parts.day };
}

function berlinMidnight(year: number, month: number, day: number): Date {
  const targetAsUtc = Date.UTC(year, month - 1, day);
  let instant = targetAsUtc;
  // Resolve the Europe/Berlin offset at the target date without depending on
  // the server timezone. The second pass also handles DST transition weeks.
  for (let pass = 0; pass < 2; pass += 1) {
    const local = berlinDateParts(new Date(instant));
    const localAsUtc = Date.UTC(local.year, local.month - 1, local.day);
    instant -= localAsUtc - targetAsUtc;
    const hour = Number(new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Berlin', hour: '2-digit', hourCycle: 'h23',
    }).format(new Date(instant)));
    instant -= hour * 60 * 60 * 1000;
  }
  return new Date(instant);
}

export function berlinWeekBounds(now: Date): { start: Date; end: Date } {
  const local = berlinDateParts(now);
  const localDate = new Date(Date.UTC(local.year, local.month - 1, local.day));
  const weekdayFromMonday = (localDate.getUTCDay() + 6) % 7;
  localDate.setUTCDate(localDate.getUTCDate() - weekdayFromMonday);
  const start = berlinMidnight(
    localDate.getUTCFullYear(), localDate.getUTCMonth() + 1, localDate.getUTCDate(),
  );
  localDate.setUTCDate(localDate.getUTCDate() + 7);
  const end = berlinMidnight(
    localDate.getUTCFullYear(), localDate.getUTCMonth() + 1, localDate.getUTCDate(),
  );
  return { start, end };
}

export function shiftDurationMinutes(shift: WorkforceShift): number {
  const start = Date.parse(shift.start_zeit);
  const end = Date.parse(shift.end_zeit);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  const pause = Math.max(0, Number(shift.pause_minuten ?? 0));
  return Math.max(0, Math.round((end - start) / 60_000) - pause);
}

export function shiftTiming(shift: WorkforceShift, now = new Date()): ShiftTiming {
  const start = Date.parse(shift.start_zeit);
  const end = Date.parse(shift.end_zeit);
  const current = now.getTime();
  if (current < start) return 'upcoming';
  if (current < end) return 'active';
  return 'completed';
}

export function totalShiftMinutes(shifts: WorkforceShift[]): number {
  return shifts.reduce((sum, shift) => sum + shiftDurationMinutes(shift), 0);
}

export function shiftsInRange<T extends WorkforceShift>(
  shifts: T[],
  startInclusive: Date,
  endExclusive: Date,
): T[] {
  const start = startInclusive.getTime();
  const end = endExclusive.getTime();
  return shifts.filter((shift) => {
    const timestamp = Date.parse(shift.start_zeit);
    return timestamp >= start && timestamp < end;
  });
}

export function nextRelevantShift<T extends WorkforceShift>(
  shifts: T[],
  now = new Date(),
): T | null {
  const current = now.getTime();
  return [...shifts]
    .filter((shift) => Date.parse(shift.end_zeit) > current)
    .sort((a, b) => Date.parse(a.start_zeit) - Date.parse(b.start_zeit))[0] ?? null;
}
