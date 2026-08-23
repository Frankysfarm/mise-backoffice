import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const route = readFileSync('app/api/kitchen/tickets/[itemId]/status/route.ts', 'utf8');
const migration = readFileSync('scripts/migrations/084_kitchen_ticket_flow.sql', 'utf8');

describe('kitchen ticket route contract', () => {
  it('binds every write to tenant, location, station and idempotency', () => {
    expect(route).toContain(".eq('tenant_id', tenantId)");
    expect(route).toContain(".eq('location_id', locationId)");
    expect(route).toContain(".eq('station_id', stationId)");
    expect(route).toContain("req.headers.get('idempotency-key')");
    expect(route).toContain("svc.rpc('advance_kitchen_ticket_item_atomic'");
  });

  it('keeps kitchen writes behind service-only RPCs and persistent audit', () => {
    expect(migration).toContain('create table if not exists public.kitchen_tickets');
    expect(migration).toContain('create table if not exists public.kitchen_ticket_events');
    expect(migration).toContain('enqueue_kitchen_item_084');
    expect(migration).toContain('from public, anon, authenticated');
    expect(migration).toContain('Kitchen actor is outside tenant or location');
  });
});
