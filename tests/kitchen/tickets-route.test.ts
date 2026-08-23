import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const route = readFileSync('app/api/kitchen/tickets/[itemId]/status/route.ts', 'utf8');
const migration = readFileSync('scripts/migrations/084_kitchen_ticket_flow.sql', 'utf8');
const display = readFileSync('app/kitchen/display/[token]/client.tsx', 'utf8');
const webhook = readFileSync('app/api/stripe/webhook/route.ts', 'utf8');
const posMigration = readFileSync('scripts/migrations/083_pos_sale_atomic.sql', 'utf8');
const rollback = readFileSync('scripts/rollback/084_kitchen_ticket_flow.rollback.sql', 'utf8');

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

  it('releases verified card payments atomically and keeps retries idempotent', () => {
    expect(migration).toContain('enqueue_kitchen_payment_084');
    expect(migration).toContain('after update of bezahlt');
    expect(migration).toContain("old.bezahlt is distinct from true");
    expect(migration).toContain("Kitchen idempotency key conflict");
    expect(webhook).toContain("reason: 'payment_release_failed'");
    expect(webhook).toContain("obj.payment_status === 'paid'");
  });

  it('bounds backfill and classifies QR, POS, staff and external orders', () => {
    expect(migration).toContain("now() - interval '24 hours'");
    expect(migration).toContain("p_order_channel = 'tisch'");
    expect(migration).toContain("p_order_channel in ('pos', 'kasse')");
    expect(migration).toContain("p_external_source");
    expect(migration).toContain("p_employee_id is not null then 'staff'");
    expect(posMigration).toContain("greatest(5, v_item_count * 3), 'pos'");
  });

  it('shows KDS network failures and retains only pre-existing compatibility columns on rollback', () => {
    expect(display).toContain("setTransitionError('Netzwerkfehler:");
    expect(rollback).toContain('drop trigger if exists enqueue_kitchen_payment_084');
    expect(rollback).toContain('Compatibility columns predate 084 in production and are retained.');
    expect(rollback).not.toContain('drop column if exists station_id');
    expect(rollback).not.toContain('drop column if exists station_status');
    expect(rollback).not.toContain('drop column if exists order_channel');
  });
});
