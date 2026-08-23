import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const route = readFileSync('app/api/pos/checkout/route.ts', 'utf8');
const sumupRoute = readFileSync('app/api/pos/sumup/checkout/route.ts', 'utf8');
const migration = readFileSync('scripts/migrations/083_pos_sale_atomic.sql', 'utf8');

describe('POS checkout security contract', () => {
  it('derives tenant/location/employee and validates register, shift and table server-side', () => {
    expect(route).toContain(".eq('auth_user_id', user.id)");
    expect(route).toContain(".from('pos_registers')");
    expect(route).toContain(".from('pos_shifts')");
    expect(route).toContain(".eq('employee_id', employee.id)");
    expect(route).toContain(".eq('status', 'offen')");
    expect(route).toContain(".from('restaurant_tables')");
  });

  it('recalculates menu pricing and fails closed for unverified card payments', () => {
    expect(route).toContain(".from('menu_items')");
    expect(route).toContain('resolvePosCart({');
    expect(route).not.toContain('body.brutto_gesamt');
    expect(route).toContain("checkout.status !== 'PAID'");
    expect(route).toContain("checkout.checkout_reference !== 'pos-' + input.idempotencyKey");
    expect(route).toContain('checkout.merchant_code !== tenant.sumup_merchant_code');
    expect(route).toContain('!amountMatches');
  });

  it('creates and polls SumUp only from a server-priced authenticated sale', () => {
    expect(sumupRoute).toContain(".eq('auth_user_id', user.id)");
    expect(sumupRoute).toContain(".from('pos_registers')");
    expect(sumupRoute).toContain(".from('pos_shifts')");
    expect(sumupRoute).toContain(".from('menu_items')");
    expect(sumupRoute).toContain('resolvePosCart({');
    expect(sumupRoute).toContain("checkout_reference: 'pos-' + idempotencyKey");
    expect(sumupRoute).toContain("checkout.checkout_reference !== 'pos-' + idempotencyKey");
    expect(sumupRoute).not.toContain('body.amount');
    expect(sumupRoute).not.toContain('body.tenant_id');
  });
  it('uses a service-only atomic and idempotent database boundary', () => {
    expect(route).toContain("svc.rpc('create_pos_sale_atomic'");
    expect(migration).toContain('pg_advisory_xact_lock');
    expect(migration).toContain('ux_pos_transactions_tenant_idempotency');
    expect(migration).toContain('insert into public.customer_orders');
    expect(migration).toContain('insert into public.order_items');
    expect(migration).toContain('insert into public.pos_transactions');
    expect(migration).toContain('insert into public.pos_transaction_items');
    expect(migration).toMatch(/revoke all on function public\.create_pos_sale_atomic[\s\S]+from public, anon, authenticated/i);
    expect(migration).toMatch(/grant execute on function public\.create_pos_sale_atomic[\s\S]+to service_role/i);
  });
});
