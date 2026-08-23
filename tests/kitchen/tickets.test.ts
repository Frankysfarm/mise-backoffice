import { describe, expect, it } from 'vitest';
import {
  canAdvanceKitchenItem,
  isKitchenTargetStatus,
  kitchenTransitionError,
  toLegacyStationStatus,
} from '@/lib/kitchen/tickets';

describe('kitchen ticket domain', () => {
  it('allows only forward kitchen transitions', () => {
    expect(canAdvanceKitchenItem('queued', 'preparing')).toBe(true);
    expect(canAdvanceKitchenItem('queued', 'ready')).toBe(true);
    expect(canAdvanceKitchenItem('preparing', 'ready')).toBe(true);
    expect(canAdvanceKitchenItem('ready', 'preparing')).toBe(false);
    expect(canAdvanceKitchenItem('cancelled', 'ready')).toBe(false);
  });

  it('validates targets and maps the compatibility status', () => {
    expect(isKitchenTargetStatus('ready')).toBe(true);
    expect(isKitchenTargetStatus('queued')).toBe(false);
    expect(toLegacyStationStatus('preparing')).toBe('in_arbeit');
    expect(toLegacyStationStatus('cancelled')).toBe('storniert');
  });

  it('maps database conflicts without leaking SQL details', () => {
    expect(kitchenTransitionError({ message: 'Kitchen item status transition is not allowed' })).toEqual({
      status: 409,
      error: 'Dieser Küchenstatus ist nicht mehr aktuell',
    });
    expect(kitchenTransitionError({ message: 'sensitive database detail' })).toEqual({
      status: 500,
      error: 'Küchenstatus konnte nicht gespeichert werden',
    });
  });
});
