import { describe, expect, it } from 'vitest';
import { previewRecurrence, validateRecurrenceRule } from '@/lib/operations/recurrence';

describe('operational recurrence', () => {
  it.each([
    [{ kind: 'daily' as const }, 5], [{ kind: 'weekdays' as const, weekdays: [1, 3, 5] }, 5],
    [{ kind: 'weekly' as const, weekday: 1 }, 5], [{ kind: 'monthly_day' as const, day: 31 }, 5],
    [{ kind: 'monthly_weekday' as const, ordinal: 1, weekday: 1 }, 5], [{ kind: 'interval' as const, interval: 2, unit: 'weeks' as const }, 5],
  ])('previews %o deterministically', (rule, count) => expect(previewRecurrence(rule, new Date('2026-08-31T00:00:00Z'), count)).toHaveLength(count));

  it('clamps month-end and preserves Berlin wall time across DST', () => {
    const monthEnd = previewRecurrence({ kind: 'monthly_day', day: 31, time: '09:00' }, new Date('2026-09-01T00:00:00Z'), 2);
    expect(monthEnd.map((date) => new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date))).toEqual(['30.09., 09:00', '31.10., 09:00']);
    const dst = previewRecurrence({ kind: 'daily', time: '09:00' }, new Date('2026-10-24T00:00:00Z'), 3);
    expect(dst.map((date) => new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' }).format(date))).toEqual(['09:00', '09:00', '09:00']);
  });

  it('validates every event-driven recurrence kind', () => {
    expect(['shift', 'opening', 'closing'].every((kind) => validateRecurrenceRule({ kind: kind as 'shift' }))).toBe(true);
  });
});
