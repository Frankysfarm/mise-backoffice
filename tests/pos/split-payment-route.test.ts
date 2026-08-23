import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const route = readFileSync('app/api/pos/split/route.ts', 'utf8');
const helper = readFileSync('lib/pos/split-payment.ts', 'utf8');
const migration = readFileSync('scripts/migrations/085_pos_split_payment.sql', 'utf8');
const rollback = readFileSync('scripts/rollback/085_pos_split_payment.rollback.sql', 'utf8');
const ui = readFileSync('components/design/pos/SplitPaymentScreen.jsx', 'utf8');

describe('POS split payment release contract', () => {
  it('binds identity and runtime context only from authenticated server context', () => {
    expect(route).toContain(".eq('auth_user_id', user.id)");
    expect(route).toContain(".from('pos_registers')");
    expect(route).toContain(".from('pos_shifts')");
    expect(route).toContain(".eq('employee_id', context.employee.id)");
    expect(route).toContain(".from('restaurant_tables')");
    expect(route).not.toContain('body.tenantId');
    expect(route).not.toContain('body.locationId');
    expect(migration).toContain('POS split employee binding failed');
    expect(migration).toContain('POS split shift binding failed');
    expect(migration).toContain('POS split table binding failed');
  });

  it('uses integer cents, allocation ledgers and exact completion only', () => {
    expect(migration).toContain('total_cents integer not null');
    expect(migration).toContain('amount_cents integer not null');
    expect(migration).toContain("scope_type in ('amount', 'items', 'seat')");
    expect(migration).toContain('Split payment must be positive');
    expect(migration).toContain('Split payment exceeds remaining total');
    expect(migration).toContain('v_completed := v_paid = v_session.total_cents');
    expect(migration).toMatch(/if v_completed then[\s\S]+set bezahlt = true/i);
    expect(helper).toContain('Number.isInteger(cents)');
  });

  it('serializes every session and idempotency key and protects browser roles', () => {
    expect(migration).toContain("pg_advisory_xact_lock(");
    expect(migration).toContain("'pos-split-payment:'");
    expect(migration).toContain("'pos-split-session:'");
    expect(migration).toContain('for update');
    expect(migration).toContain('unique (tenant_id, idempotency_key)');
    expect(migration).toContain('Split payment idempotency key conflict');
    expect(migration).toContain('for update of pa');
    expect(migration).toContain('v_recorded_received is distinct from p_cash_received_cents');
    expect(migration).toContain('ux_pos_payment_allocation_attempt_item');
    expect(migration).toMatch(/revoke all on function public\.record_pos_split_cash_085[\s\S]+from public, anon, authenticated/i);
  });

  it('fails closed for SumUp and Stripe until exact provider verification', () => {
    expect(route).toContain('verifyProviderCheckout({');
    expect(route).toContain("verification.state === 'pending'");
    expect(route).toContain("verification.state === 'failed'");
    expect(route).toContain("confirm_pos_split_payment_085");
    expect(route.indexOf('requireProviderConfiguration(provider, tenant)'))
      .toBeLessThan(route.indexOf("rpc('prepare_pos_split_payment_085'"));
    expect(helper).toContain("checkout.status === 'PAID'");
    expect(helper).toContain("session.payment_status === 'paid'");
    expect(helper).toContain('session.amount_total !== input.amountCents');
    expect(helper).toContain("checkout.checkout_reference !== 'split-' + input.attemptId");
    expect(helper).toContain("session.metadata?.split_attempt_id !== input.attemptId");
  });

  it('keeps partial orders unpaid and delegates exact final release to kitchen trigger 084', () => {
    expect(migration).toContain("'wartet_auf_zahlung'");
    expect(migration).toMatch(/'split', false, now\(\)/);
    expect(migration).toMatch(/where o\.id = v_session\.order_id[\s\S]+coalesce\(o\.bezahlt, false\) = false/i);
    expect(migration).not.toContain('insert into public.kitchen_tickets');
  });

  it('exposes touch and keyboard accessible remaining, retry and payment states', () => {
    expect(ui).toContain('Noch offen');
    expect(ui).toContain('Teilzahlungen');
    expect(ui).toContain('inputMode="decimal"');
    expect(ui).toContain("event.key === 'Enter'");
    expect(ui).toContain('Bitte nicht doppelt tippen');
    expect(ui).toContain('Erneut versuchen');
    expect(ui).toContain('Zahlungsstatus erneut prüfen');
    expect(ui).toContain('pendingProvider');
    expect(ui).toContain('Sitz / Gast');
    expect(ui).toContain('role="alert"');
  });

  it('rollback removes only 085-owned functions and tables', () => {
    expect(rollback).toContain('drop table if exists public.pos_payment_allocations');
    expect(rollback).toContain('drop table if exists public.pos_payment_attempts');
    expect(rollback).toContain('drop table if exists public.pos_split_sessions');
    expect(rollback).not.toContain('alter table public.customer_orders');
    expect(rollback).not.toContain('drop function if exists public.enqueue_kitchen');
  });
});
