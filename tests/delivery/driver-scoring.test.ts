import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/google-maps', () => ({
  haversineKm: (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
    const toRad = (value: number) => value * Math.PI / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  },
}));

import { rankDrivers, scoreDriver, type DriverScoreInput, type OrderScoreInput } from '@/lib/delivery/scoring';

const order: OrderScoreInput = {
  id: 'order-1',
  location_id: 'location-1',
  kunde_lat: 50.78,
  kunde_lng: 6.09,
  restaurant_lat: 50.775,
  restaurant_lng: 6.084,
  zone: 'A',
  priority: 'normal',
  item_count: 2,
  estimated_prep_min: 15,
  created_at: '2026-08-21T15:45:00.000Z',
};

const baseDriver: DriverScoreInput = {
  id: 'driver-1',
  vehicle: 'bike',
  last_lat: 50.775,
  last_lng: 6.084,
  current_capacity: 0,
  max_capacity: 3,
  total_deliveries: 100,
  zone: 'A',
  rating: 4.8,
  avg_delivery_min: 20,
};

describe('driver ranking algorithm', () => {
  beforeEach(() => vi.useRealTimers());

  it('excludes a driver whose capacity is exhausted', () => {
    expect(scoreDriver({ ...baseDriver, current_capacity: 3 }, order, new Date('2026-08-21T16:00:00.000Z'))).toBeNull();
    expect(scoreDriver({ ...baseDriver, max_capacity: 0 }, order, new Date('2026-08-21T16:00:00.000Z'))).toBeNull();
  });

  it('ranks an otherwise equal nearby driver ahead of a distant one', () => {
    const nearby = { ...baseDriver, id: 'nearby' };
    const distant = { ...baseDriver, id: 'distant', last_lat: 50.84, last_lng: 6.16 };
    const ranked = rankDrivers([distant, nearby], order, new Date('2026-08-21T16:00:00.000Z'));
    expect(ranked.map((entry) => entry.driver.id)).toEqual(['nearby', 'distant']);
    expect(ranked[0].score.f_distance).toBeGreaterThan(ranked[1].score.f_distance);
  });

  it('penalizes a bike for a large order compared with a car', () => {
    const largeOrder = { ...order, item_count: 8 };
    const bike = scoreDriver(baseDriver, largeOrder, new Date('2026-08-21T16:00:00.000Z'))!;
    const car = scoreDriver({ ...baseDriver, vehicle: 'car' }, largeOrder, new Date('2026-08-21T16:00:00.000Z'))!;
    expect(car.f_vehicle).toBe(10);
    expect(bike.f_vehicle).toBe(3);
    expect(car.total).toBeGreaterThan(bike.total);
  });

  it('uses the real Berlin summer-time hour for rush-hour scoring', () => {
    // 16:15 UTC is 18:15 in Berlin in August (CEST).
    const score = scoreDriver(baseDriver, order, new Date('2026-08-21T16:15:00.000Z'))!;
    expect(score.f_time_of_day).toBe(6);
  });

  it('keeps every factor and the total inside the documented range', () => {
    const score = scoreDriver({ ...baseDriver, rating: -5, avg_delivery_min: 99 }, order, new Date('2026-08-21T10:00:00.000Z'))!;
    for (const [key, value] of Object.entries(score)) {
      if (key === 'total') continue;
      expect(value, key).toBeGreaterThanOrEqual(0);
      expect(value, key).toBeLessThanOrEqual(10);
    }
    expect(score.total).toBeGreaterThanOrEqual(0);
    expect(score.total).toBeLessThanOrEqual(100);
  });
});
