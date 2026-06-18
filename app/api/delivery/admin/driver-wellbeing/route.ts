import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  getWellbeingDashboard,
  getDriverWellbeing,
  snapshotAllDriversForLocation,
  triggerIntervention,
  pruneOldSnapshots,
  type InterventionType,
} from '@/lib/delivery/driver-wellbeing';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const { searchParams } = new URL(req.url);
  const qpLocation = searchParams.get('location_id');

  const sb = createServiceClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  if (qpLocation) return qpLocation;

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  return (emp?.location_id as string | null) ?? null;
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const action   = searchParams.get('action') ?? 'dashboard';
  const driverId = searchParams.get('driver_id');

  try {
    if (action === 'driver' && driverId) {
      const data = await getDriverWellbeing(locationId, driverId);
      return NextResponse.json({ ok: true, data });
    }

    // default: dashboard
    const data = await getWellbeingDashboard(locationId);
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = createServiceClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as {
    action: string;
    driver_id?: string;
    intervention_type?: InterventionType;
  };

  try {
    if (body.action === 'snapshot') {
      const result = await snapshotAllDriversForLocation(locationId);
      return NextResponse.json({ ok: true, result });
    }

    if (body.action === 'trigger_intervention' && body.driver_id && body.intervention_type) {
      const result = await triggerIntervention(
        locationId,
        body.driver_id,
        body.intervention_type,
        user.id,
      );
      return NextResponse.json(result);
    }

    if (body.action === 'prune') {
      const deleted = await pruneOldSnapshots(90);
      return NextResponse.json({ ok: true, deleted });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
