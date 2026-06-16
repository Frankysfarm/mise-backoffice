import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  recordAmendment,
  getAmendmentHistory,
  getAmendmentDashboard,
  getInFlightAmendments,
  getDailyAmendmentTrend,
  type AmendmentType,
} from '@/lib/delivery/order-amendments';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const sb = createServiceClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const qp = new URL(req.url).searchParams.get('location_id');
  if (qp) return qp;

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('user_id', user.id)
    .maybeSingle();
  return emp?.location_id ? String(emp.location_id) : null;
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = new URL(req.url).searchParams;
  const action = sp.get('action') ?? 'dashboard';

  if (action === 'dashboard') {
    const data = await getAmendmentDashboard(locationId);
    return NextResponse.json({ ok: true, data });
  }

  if (action === 'in_flight') {
    const data = await getInFlightAmendments(locationId);
    return NextResponse.json({ ok: true, data });
  }

  if (action === 'trend') {
    const data = await getDailyAmendmentTrend(locationId);
    return NextResponse.json({ ok: true, data });
  }

  if (action === 'history') {
    const orderId = sp.get('order_id');
    if (!orderId) return NextResponse.json({ error: 'order_id required' }, { status: 400 });
    const data = await getAmendmentHistory(orderId, locationId);
    return NextResponse.json({ ok: true, data });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = createServiceClient();
  const { data: { user } } = await sb.auth.getUser();

  const body = (await req.json()) as {
    action?: string;
    order_id?: string;
    amendment_type?: AmendmentType;
    field_name?: string;
    old_value?: unknown;
    new_value?: unknown;
    reason?: string;
    affected_dispatch?: boolean;
    eta_recalculated?: boolean;
    delta_eur?: number;
    batch_id?: string;
  };

  if (body.action === 'record' || !body.action) {
    if (!body.order_id || !body.amendment_type) {
      return NextResponse.json(
        { error: 'order_id and amendment_type required' },
        { status: 400 },
      );
    }

    // Verify order belongs to this location
    const { data: order } = await sb
      .from('customer_orders')
      .select('id, location_id')
      .eq('id', body.order_id)
      .eq('location_id', locationId)
      .maybeSingle();

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const amendment = await recordAmendment({
      locationId,
      orderId: body.order_id,
      amendedByUser: user?.id,
      amendmentType: body.amendment_type,
      fieldName: body.field_name,
      oldValue: body.old_value,
      newValue: body.new_value,
      reason: body.reason,
      affectedDispatch: body.affected_dispatch ?? false,
      etaRecalculated: body.eta_recalculated ?? false,
      deltaEur: body.delta_eur ?? 0,
      batchId: body.batch_id,
    });

    return NextResponse.json({ ok: true, amendment });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
