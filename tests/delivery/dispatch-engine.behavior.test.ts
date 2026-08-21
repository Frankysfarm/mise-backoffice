import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  type Driver = {
    id: string;
    auth_user_id: string | null;
    employee_id: string | null;
    vehicle: 'bike' | 'car';
    max_radius_km: number;
    last_lat: number;
    last_lng: number;
    current_capacity: number;
    max_capacity: number;
    total_deliveries: number;
    state: string;
    active: boolean;
    shift_started_at: string;
  };
  const state = {
    drivers: [] as Driver[],
    itemCount: 1,
    failClaimsFor: new Set<string>(),
    claimArgs: [] as Array<Record<string, unknown>>,
    fromCalls: [] as string[],
  };

  function resultFor(table: string) {
    if (table === 'order_items') return { data: null, error: null, count: state.itemCount };
    if (table === 'mise_drivers') {
      return {
        data: state.drivers.map((driver) => ({
          id: driver.id,
          rating: driver.id.endsWith('car') ? 4.8 : 4.7,
          avg_delivery_min: 22,
          zone: 'A',
        })),
        error: null,
      };
    }
    if (table === 'mise_delivery_batches') return { data: [], error: null };
    return { data: null, error: null };
  }

  function query(table: string) {
    const chain: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'in', 'is', 'not', 'neq', 'gte', 'lte', 'or', 'order', 'limit', 'update', 'insert']) {
      chain[method] = vi.fn(() => chain);
    }
    chain.maybeSingle = vi.fn(async () => table === 'locations'
      ? {
          data: {
            id: 'location-1', tenant_id: 'tenant-1', name: 'Mise Test',
            lat: 50.775, lng: 6.084, adresse: 'Markt 1', plz: '52062', stadt: 'Aachen',
          },
          error: null,
        }
      : { data: null, error: null });
    chain.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(resultFor(table)).then(resolve, reject);
    return chain;
  }

  const client = {
    from: vi.fn((table: string) => {
      state.fromCalls.push(table);
      return query(table);
    }),
    rpc: vi.fn(async (name: string, args?: Record<string, unknown>) => {
      if (name === 'get_eligible_delivery_drivers') return { data: state.drivers, error: null };
      if (name === 'claim_delivery_order') {
        state.claimArgs.push(args ?? {});
        const driverId = String(args?.p_driver_id ?? '');
        if (state.failClaimsFor.has(driverId)) return { data: null, error: { message: 'concurrent claim lost' } };
        return { data: { batch_id: `batch-${driverId}`, outcome: 'dispatched' }, error: null };
      }
      return { data: null, error: null };
    }),
  };

  return {
    state,
    client,
    classifyZone: vi.fn(),
    findBundleCandidates: vi.fn(),
    optimizeTour: vi.fn(),
    calculateEta: vi.fn(),
  };
});

vi.mock('@supabase/supabase-js', () => ({ createClient: () => mocks.client }));
vi.mock('@/lib/google-maps', () => ({
  geocode: vi.fn(),
  haversineKm: (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
    const dLat = (b.lat - a.lat) * 111;
    const dLng = (b.lng - a.lng) * 71;
    return Math.sqrt(dLat ** 2 + dLng ** 2);
  },
}));
vi.mock('@/lib/delivery/zones', () => ({ classifyZone: mocks.classifyZone }));
vi.mock('@/lib/delivery/bundling', () => ({ findBundleCandidates: mocks.findBundleCandidates }));
vi.mock('@/lib/delivery/tour-optimizer', () => ({ optimizeTour: mocks.optimizeTour }));
vi.mock('@/lib/delivery/eta', () => ({ calculateEta: mocks.calculateEta, updateOrderEta: vi.fn() }));
vi.mock('@/lib/delivery/kitchen-sync', () => ({ upsertKitchenTiming: vi.fn() }));
vi.mock('@/lib/delivery/events', () => ({ logDeliveryEvent: vi.fn() }));
vi.mock('@/lib/delivery/push-notify', () => ({ enqueueBatchPush: vi.fn(async () => undefined) }));
vi.mock('@/lib/delivery/eta-calibration', () => ({ logEtaPrediction: vi.fn(async () => undefined) }));
vi.mock('@/lib/delivery/customer-notify', () => ({ recordCustomerEvent: vi.fn(async () => undefined) }));
vi.mock('@/lib/delivery/windows', () => ({ markWindowDispatched: vi.fn(async () => undefined) }));

import { dispatchSingleOrder } from '@/lib/delivery/dispatch-engine';

const order = {
  id: 'order-1',
  location_id: 'location-1',
  kunde_lat: 50.78,
  kunde_lng: 6.09,
  kunde_adresse: 'Kunde 2',
  kunde_plz: '52064',
  kunde_stadt: 'Aachen',
  bestellnummer: 'TEST-1',
  priority: 'normal',
  estimated_prep_min: 15,
  created_at: '2026-08-21T12:00:00.000Z',
  dispatch_attempts: 0,
  dispatch_escalated_at: null,
  schedule_status: 'immediate' as const,
};

function driver(id: string, vehicle: 'bike' | 'car', lat = 50.775, lng = 6.084) {
  return {
    id, auth_user_id: `auth-${id}`, employee_id: `employee-${id}`, vehicle,
    max_radius_km: 5, last_lat: lat, last_lng: lng, current_capacity: 0,
    max_capacity: 3, total_deliveries: 100, state: 'idle', active: true,
    shift_started_at: '2026-08-21T10:00:00.000Z',
  };
}

describe('smart dispatch behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.drivers = [];
    mocks.state.itemCount = 1;
    mocks.state.failClaimsFor.clear();
    mocks.state.claimArgs = [];
    mocks.state.fromCalls = [];
    mocks.classifyZone.mockResolvedValue({ zone: 'A', zoneConfig: null, distanceKm: 1.2 });
    mocks.findBundleCandidates.mockResolvedValue({ shouldBundle: false, candidateBatchId: null, reason: 'new tour' });
    mocks.optimizeTour.mockResolvedValue(undefined);
    mocks.calculateEta.mockResolvedValue({
      earliestUtc: new Date('2026-08-21T12:20:00.000Z'),
      latestUtc: new Date('2026-08-21T12:30:00.000Z'),
    });
  });

  it('uses the real item count and prefers a car for a large order', async () => {
    mocks.state.itemCount = 8;
    mocks.state.drivers = [driver('driver-bike', 'bike'), driver('driver-car', 'car')];

    const result = await dispatchSingleOrder({ ...order });

    expect(result.outcome).toBe('dispatched');
    expect(result.driverId).toBe('driver-car');
    expect(mocks.state.claimArgs[0]).toMatchObject({ p_driver_id: 'driver-car' });
    expect(mocks.findBundleCandidates).toHaveBeenCalledWith(
      'driver-car', 50.775, 6.084, 50.78, 6.09, 3,
    );
  });

  it('excludes a high-scoring driver outside the configured radius', async () => {
    const farCar = { ...driver('driver-car', 'car', 50.9, 6.2), max_radius_km: 1 };
    mocks.state.itemCount = 8;
    mocks.state.drivers = [farCar, driver('driver-bike', 'bike')];

    const result = await dispatchSingleOrder({ ...order });

    expect(result.driverId).toBe('driver-bike');
    expect(mocks.state.claimArgs.map((args) => args.p_driver_id)).toEqual(['driver-bike']);
  });

  it('falls through to the next ranked driver when an atomic claim loses a race', async () => {
    mocks.state.drivers = [driver('driver-car', 'car'), driver('driver-bike', 'bike')];
    mocks.state.failClaimsFor.add('driver-car');

    const result = await dispatchSingleOrder({ ...order });

    expect(result.driverId).toBe('driver-bike');
    expect(mocks.state.claimArgs.map((args) => args.p_driver_id)).toEqual(['driver-car', 'driver-bike']);
  });

  it('holds the order without a claim when no eligible driver exists', async () => {
    const result = await dispatchSingleOrder({ ...order });
    expect(result).toMatchObject({ outcome: 'held', driverId: null, reason: 'Kein aktiver Fahrer verfügbar' });
    expect(mocks.state.claimArgs).toHaveLength(0);
  });
});
