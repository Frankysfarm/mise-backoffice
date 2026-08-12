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
});
