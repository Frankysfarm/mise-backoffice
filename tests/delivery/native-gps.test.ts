import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mapBackendDriverState, validateNativeGpsEnvelope } from '../../lib/delivery/native-gps';

const now = Date.parse('2026-08-16T10:00:00.000Z');
const valid = {
  action_id: '10000000-0000-4000-8000-000000000001',
  expected_state: 'delivering',
  expected_versions: { driver: 0 },
  payload: {
    action_id: '10000000-0000-4000-8000-000000000001',
    installation_id: '10000000-0000-4000-8000-000000000002',
    session_id: '10000000-0000-4000-8000-000000000003',
    sequence: 7,
    captured_at: '2026-08-16T09:59:50.000Z',
    latitude: 53.5511,
    longitude: 9.9937,
    accuracy_m: 8,
    speed_mps: 4,
    app_version: '1.0.0',
    platform: 'ios',
    app_state: 'background',
    permission_state: 'always',
    network_state: 'unknown',
    tracking_mode: 'significant_change',
  },
};

describe('native background GPS contract', () => {
  it('lets the manifest and bearer-authenticated v2 API reach their handlers', () => {
    const middleware = readFileSync(resolve(process.cwd(), 'lib/supabase/middleware.ts'), 'utf8');
    expect(middleware).toContain("pathname === '/fahrer.webmanifest'");
    expect(middleware).toContain("pathname.startsWith('/api/driver/')");
  });
  it('maps existing backend states to the native authority vocabulary', () => {
    expect(mapBackendDriverState('idle')).toBe('available');
    expect(mapBackendDriverState('at_restaurant')).toBe('at_pickup');
    expect(mapBackendDriverState('en_route')).toBe('delivering');
    expect(mapBackendDriverState('offline')).toBe('offline');
  });

  it('accepts the canonical iOS background payload', () => {
    expect(validateNativeGpsEnvelope(valid, now).payload.sequence).toBe(7);
  });

  it('rejects identity mismatch, stale data and impossible coordinates', () => {
    expect(() => validateNativeGpsEnvelope({ ...valid, action_id: '10000000-0000-4000-8000-000000000009' }, now))
      .toThrow('INVALID_ACTION_ID');
    expect(() => validateNativeGpsEnvelope({ ...valid, payload: { ...valid.payload, captured_at: '2026-08-14T09:00:00Z' } }, now))
      .toThrow('INVALID_GPS_CAPTURE_TIME');
    expect(() => validateNativeGpsEnvelope({ ...valid, payload: { ...valid.payload, latitude: 100 } }, now))
      .toThrow('INVALID_GPS_COORDINATES');
  });
});
