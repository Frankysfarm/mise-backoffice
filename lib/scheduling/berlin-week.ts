import { berlinWeekBounds } from '@/lib/workforce/shifts';

const ISO_CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const BERLIN_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export type BerlinScheduleWeek = {
  calendarStart: string;
  rangeStart: Date;
  rangeEnd: Date;
};

function calendarDateParts(value: string): { year: number; month: number; day: number } | null {
  const match = ISO_CALENDAR_DATE.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const normalized = new Date(Date.UTC(year, month - 1, day));
  if (
    normalized.getUTCFullYear() !== year
    || normalized.getUTCMonth() !== month - 1
    || normalized.getUTCDate() !== day
  ) return null;
  return { year, month, day };
}

export function berlinCalendarDate(value: Date): string {
  const parts = Object.fromEntries(
    BERLIN_DATE.formatToParts(value)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function addCalendarDays(value: string, days: number): string {
  const parts = calendarDateParts(value);
  if (!parts) throw new Error(`Ungültiges Kalenderdatum: ${value}`);
  const result = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return result.toISOString().slice(0, 10);
}

export function berlinScheduleWeek(param?: string, now = new Date()): BerlinScheduleWeek {
  const parts = param ? calendarDateParts(param) : null;
  const reference = parts
    ? new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12))
    : now;
  const { start, end } = berlinWeekBounds(reference);
  return {
    calendarStart: berlinCalendarDate(start),
    rangeStart: start,
    rangeEnd: end,
  };
}

export function calendarDisplayDate(value: string): Date {
  const parts = calendarDateParts(value);
  if (!parts) throw new Error(`Ungültiges Kalenderdatum: ${value}`);
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12));
}
