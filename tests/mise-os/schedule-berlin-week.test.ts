import { describe, expect, it } from 'vitest';
import {
  addCalendarDays,
  berlinCalendarDate,
  berlinScheduleWeek,
  calendarDisplayDate,
} from '@/lib/scheduling/berlin-week';

describe('schedule Berlin calendar week', () => {
  it('keeps an explicit Monday while using Berlin-midnight query bounds', () => {
    const week = berlinScheduleWeek('2026-09-14');

    expect(week.calendarStart).toBe('2026-09-14');
    expect(week.rangeStart.toISOString()).toBe('2026-09-13T22:00:00.000Z');
    expect(week.rangeEnd.toISOString()).toBe('2026-09-20T22:00:00.000Z');
  });

  it('normalizes another day in the requested week to Monday', () => {
    expect(berlinScheduleWeek('2026-09-20').calendarStart).toBe('2026-09-14');
  });

  it('uses the Berlin date when UTC is still on Sunday', () => {
    const week = berlinScheduleWeek(undefined, new Date('2026-08-30T22:30:00.000Z'));

    expect(week.calendarStart).toBe('2026-08-31');
  });

  it('rejects malformed calendar dates without letting them alter the week', () => {
    const now = new Date('2026-09-16T12:00:00.000Z');

    expect(berlinScheduleWeek('2026-02-30', now).calendarStart).toBe('2026-09-14');
  });

  it('navigates and displays dates without a local-timezone conversion', () => {
    expect(addCalendarDays('2026-09-14', -7)).toBe('2026-09-07');
    expect(addCalendarDays('2026-09-14', 7)).toBe('2026-09-21');
    expect(calendarDisplayDate('2026-09-14').toISOString()).toBe('2026-09-14T12:00:00.000Z');
    expect(berlinCalendarDate(new Date('2026-09-13T22:00:00.000Z'))).toBe('2026-09-14');
  });
});
