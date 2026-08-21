import { describe, expect, it } from 'vitest';
import {
  berlinWeekBounds,
  nextRelevantShift,
  shiftDurationMinutes,
  shiftTiming,
  shiftsInRange,
  totalShiftMinutes,
} from '@/lib/workforce/shifts';

describe('employee shift calculations', () => {
  const shift = {
    start_zeit: '2026-08-21T08:00:00.000Z',
    end_zeit: '2026-08-21T16:30:00.000Z',
    pause_minuten: 30,
  };

  it('subtracts the configured break from paid duration', () => {
    expect(shiftDurationMinutes(shift)).toBe(480);
  });

  it('never returns negative duration for malformed ranges or breaks', () => {
    expect(shiftDurationMinutes({ ...shift, end_zeit: shift.start_zeit })).toBe(0);
    expect(shiftDurationMinutes({ ...shift, pause_minuten: 600 })).toBe(0);
  });

  it('classifies upcoming, active and completed shifts at their boundaries', () => {
    expect(shiftTiming(shift, new Date('2026-08-21T07:59:59.000Z'))).toBe('upcoming');
    expect(shiftTiming(shift, new Date('2026-08-21T08:00:00.000Z'))).toBe('active');
    expect(shiftTiming(shift, new Date('2026-08-21T16:30:00.000Z'))).toBe('completed');
  });

  it('picks an active shift before a later upcoming shift', () => {
    const later = { ...shift, start_zeit: '2026-08-22T08:00:00.000Z', end_zeit: '2026-08-22T12:00:00.000Z' };
    expect(nextRelevantShift([later, shift], new Date('2026-08-21T09:00:00.000Z'))).toEqual(shift);
  });

  it('filters shifts by start time using an exclusive end boundary', () => {
    const nextWeek = { ...shift, start_zeit: '2026-08-25T08:00:00.000Z', end_zeit: '2026-08-25T12:00:00.000Z' };
    expect(shiftsInRange([shift, nextWeek], new Date('2026-08-21T00:00:00.000Z'), new Date('2026-08-25T08:00:00.000Z'))).toEqual([shift]);
  });

  it('sums paid minutes across shifts', () => {
    expect(totalShiftMinutes([shift, { ...shift, start_zeit: '2026-08-22T08:00:00.000Z', end_zeit: '2026-08-22T12:00:00.000Z', pause_minuten: 0 }])).toBe(720);
  });

  it('calculates Berlin calendar weeks independently from server timezone', () => {
    const winter = berlinWeekBounds(new Date('2026-01-07T12:00:00.000Z'));
    expect(winter.start.toISOString()).toBe('2026-01-04T23:00:00.000Z');
    expect(winter.end.toISOString()).toBe('2026-01-11T23:00:00.000Z');

    const summer = berlinWeekBounds(new Date('2026-08-21T12:00:00.000Z'));
    expect(summer.start.toISOString()).toBe('2026-08-16T22:00:00.000Z');
    expect(summer.end.toISOString()).toBe('2026-08-23T22:00:00.000Z');
  });

  it('keeps the exact Berlin week across the spring DST transition', () => {
    const bounds = berlinWeekBounds(new Date('2026-03-29T12:00:00.000Z'));
    expect(bounds.start.toISOString()).toBe('2026-03-22T23:00:00.000Z');
    expect(bounds.end.toISOString()).toBe('2026-03-29T22:00:00.000Z');
  });
});
