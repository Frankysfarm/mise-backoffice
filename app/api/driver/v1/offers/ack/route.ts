import { NextRequest, NextResponse } from 'next/server';
import { getDriverFromBearer, sb, unauthorized } from '../../_lib/driver-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = await getDriverFromBearer(req);
  if (!auth) return unauthorized();

  const body = await req.json().catch(() => null) as {
    offer_id?: string;
    assignment_version?: number;
  } | null;
  if (
    !body?.offer_id ||
    !Number.isSafeInteger(body.assignment_version) ||
    Number(body.assignment_version) < 1
  ) {
    return NextResponse.json({ error: 'invalid_offer_ack' }, { status: 400 });
  }

  const client = sb();
  const { data: assignment, error: assignmentError } = await client
    .from('dispatch_offer_assignments')
    .select('order_id')
    .eq('id', body.offer_id)
    .maybeSingle();
  if (assignmentError) {
    return NextResponse.json({ error: assignmentError.message }, { status: 500 });
  }
  if (!assignment) {
    return NextResponse.json({ error: 'offer_not_found' }, { status: 404 });
  }

  const { data: order, error: orderError } = await client
    .from('customer_orders')
    .select('location_id')
    .eq('id', assignment.order_id)
    .maybeSingle();
  if (orderError || !order?.location_id) {
    return NextResponse.json({ error: orderError?.message ?? 'order_location_missing' }, { status: 409 });
  }
  const { data: location, error: locationError } = await client
    .from('locations')
    .select('tenant_id')
    .eq('id', order.location_id)
    .maybeSingle();
  if (locationError || !location?.tenant_id) {
    return NextResponse.json({ error: locationError?.message ?? 'tenant_missing' }, { status: 409 });
  }

  const { data, error } = await client.rpc('fn_dispatch_ack_offer_v1', {
    p_tenant_id: location.tenant_id,
    p_offer_id: body.offer_id,
    p_driver_id: auth.driver.id,
    p_assignment_version: body.assignment_version,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const result = data as { ok?: boolean; reason_code?: string } | null;
  if (!result?.ok) {
    return NextResponse.json(result ?? { error: 'ack_rejected' }, { status: 409 });
  }
  return NextResponse.json(result);
}
