import { describe, expect, it } from 'vitest';
import { hasCurrentDriverSession } from '@/lib/delivery/driver-shift-eligibility';

describe('driver dispatch session lease', () => {
  it('accepts a shift started on the same Berlin day', () => {
    expect(hasCurrentDriverSession('2026-08-11T08:00:00.000Z', new Date('2026-08-11T15:00:00.000Z'))).toBe(true);
  });

  it('expires at the Berlin calendar-day boundary', () => {
    expect(hasCurrentDriverSession('2026-08-11T21:50:00.000Z', new Date('2026-08-11T22:05:00.000Z'))).toBe(false);
  });

  it('rejects missing, future and overly long sessions', () => {
    const now = new Date('2026-08-11T15:00:00.000Z');
    expect(hasCurrentDriverSession(null, now)).toBe(false);
    expect(hasCurrentDriverSession('2026-08-11T15:01:00.000Z', now)).toBe(false);
    expect(hasCurrentDriverSession('2026-08-10T20:00:00.000Z', now)).toBe(false);
  });

  it('rejects the prior Berlin date even when the lease is only minutes old', () => {
    expect(hasCurrentDriverSession(
      '2026-10-24T21:55:00.000Z',
      new Date('2026-10-24T22:05:00.000Z'),
    )).toBe(false);
  });

  it('supports a configurable 03:00 Berlin workday cutoff', () => {
    // 01:55 und 02:05 UTC sind im August 03:55/04:05 Berlin and therefore
    // still the same workday after a 03:00 cutoff.
    expect(hasCurrentDriverSession(
      '2026-08-11T23:30:00.000Z',
      new Date('2026-08-12T00:30:00.000Z'),
      180,
    )).toBe(true);
    expect(hasCurrentDriverSession(
      '2026-08-11T23:30:00.000Z',
      new Date('2026-08-12T01:30:00.000Z'),
      180,
    )).toBe(false);
  });

  it('honors the configured maximum session length', () => {
    expect(hasCurrentDriverSession(
      '2026-08-11T08:00:00.000Z',
      new Date('2026-08-11T15:00:01.000Z'),
      0,
      7,
    )).toBe(false);
  });
});
