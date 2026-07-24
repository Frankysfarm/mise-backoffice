import { NextRequest, NextResponse } from 'next/server';
import { atomicOfferEnabled, expireAtomicOffers } from '@/lib/delivery/atomic-offer';
import { sb } from '../../_lib/driver-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function expiryEnabled(): boolean {
  return atomicOfferEnabled() &&
    process.env.P0_ATOMIC_OFFER_EXPIRY_ENABLED === 'true';
}

export async function POST(req: NextRequest) {
  const expected = process.env.BISS_INTERNAL_TOKEN;
  const provided = req.headers.get('x-internal-token');
  if (!expected || expected.length < 16 || provided !== expected) {
    return NextResponse.json(
      { ok: false, reason_code: 'INTERNAL_AUTH_FAILED' },
      { status: 403 },
    );
  }
  if (!expiryEnabled()) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason_code: 'ATOMIC_EXPIRY_DISABLED',
      expired: 0,
    });
  }

  const rawLimit = Number(req.nextUrl.searchParams.get('limit') ?? 100);
  if (!Number.isSafeInteger(rawLimit) || rawLimit < 1 || rawLimit > 1000) {
    return NextResponse.json(
      { ok: false, reason_code: 'INVALID_EXPIRY_LIMIT' },
      { status: 400 },
    );
  }

  const client = sb();
  /*
   * Fail closed if any currently offered atomic assignment belongs to a tenant
   * whose single-writer gate is no longer open. The SQL expiry function is
   * global, so this preflight prevents it from crossing a closed tenant gate.
   */
  const { data: offered, error: offeredError } = await client
    .from('dispatch_offer_assignments')
    .select('order_id')
    .eq('state', 'offered')
    .limit(1001);
  if (offeredError) {
    return NextResponse.json({
      ok: false,
      reason_code: 'EXPIRY_PREFLIGHT_FAILED',
      error: offeredError.message,
    }, { status: 500 });
  }
  if ((offered ?? []).length > 1000) {
    return NextResponse.json({
      ok: false,
      reason_code: 'EXPIRY_PREFLIGHT_LIMIT_EXCEEDED',
      expired: 0,
    }, { status: 503 });
  }
  const orderIds = [...new Set((offered ?? []).map((row) => row.order_id))];
  if (orderIds.length) {
    const { data: orders, error: ordersError } = await client
      .from('customer_orders')
      .select('id,location_id')
      .in('id', orderIds);
    if (ordersError || (orders ?? []).length !== orderIds.length) {
      return NextResponse.json({
        ok: false,
        reason_code: 'EXPIRY_ORDER_PREFLIGHT_FAILED',
        error: ordersError?.message,
      }, { status: 500 });
    }
    const locationIds = [...new Set((orders ?? []).map((row) => row.location_id))];
    const { data: locations, error: locationsError } = await client
      .from('locations')
      .select('id,tenant_id')
      .in('id', locationIds);
    if (locationsError || (locations ?? []).length !== locationIds.length) {
      return NextResponse.json({
        ok: false,
        reason_code: 'EXPIRY_TENANT_PREFLIGHT_FAILED',
        error: locationsError?.message,
      }, { status: 500 });
    }
    const tenantIds = [...new Set((locations ?? []).map((row) => row.tenant_id))];
    const { data: gates, error: gatesError } = await client
      .from('dispatch_writer_gates')
      .select('tenant_id')
      .in('tenant_id', tenantIds)
      .eq('writer', 'atomic_v1')
      .eq('enabled', true);
    if (gatesError) {
      return NextResponse.json({
        ok: false,
        reason_code: 'EXPIRY_GATE_PREFLIGHT_FAILED',
        error: gatesError.message,
      }, { status: 500 });
    }
    const open = new Set((gates ?? []).map((row) => row.tenant_id));
    if (tenantIds.some((tenantId) => !open.has(tenantId))) {
      return NextResponse.json({
        ok: false,
        reason_code: 'SINGLE_WRITER_GATE_CLOSED',
        expired: 0,
      }, { status: 409 });
    }
  }

  try {
    const expired = await expireAtomicOffers(client, rawLimit);
    return NextResponse.json({ ok: true, expired });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      reason_code: 'ATOMIC_EXPIRY_FAILED',
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
