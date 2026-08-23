import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('table order persistence contract', () => {
  it('creates orders and positions through one service-only atomic function', () => {
    const route = source('app/api/order/table/route.ts');
    const migration = source('scripts/migrations/082_table_order_foundation.sql');

    expect(route).toContain("svc.rpc('create_table_order_atomic'");
    expect(route).not.toContain(".from('customer_orders')");
    expect(route).not.toContain(".from('order_items')");
    expect(route).not.toContain(".delete()");
    expect(migration).toContain('insert into public.customer_orders');
    expect(migration).toContain('insert into public.order_items');
    expect(migration).toContain('security definer');
    expect(migration).toContain('to service_role');
    expect(migration).toContain('from public, anon, authenticated');
  });

  it('requires idempotency and returns the dedicated tracking capability', () => {
    const route = source('app/api/order/table/route.ts');
    const migration = source('scripts/migrations/082_table_order_foundation.sql');

    expect(route).toContain("headers.get('idempotency-key')");
    expect(route).toContain('UUID_RE.test(idempotencyKey)');
    expect(route).toContain('trackingToken: order.status_token');
    expect(migration).toContain('table_order_idempotency_key');
    expect(migration).toContain('pg_advisory_xact_lock');
    expect(migration).toContain('return query select v_order_id, v_order_number, v_status_token, false');
  });

  it('ships a reversible migration and an executable SQL behavior test', () => {
    const rollback = source('scripts/rollback/082_table_order_foundation.rollback.sql');
    const sqlTest = source('scripts/tests/082_table_order_foundation.sql');
    expect(rollback).toContain('drop function if exists public.create_table_order_atomic');
    expect(rollback).toContain('drop column if exists table_order_idempotency_key');
    expect(sqlTest).toContain('table order retry was not idempotent');
    expect(sqlTest).toContain('browser roles can execute table order function');
  });
});
