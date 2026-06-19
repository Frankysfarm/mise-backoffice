import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getReturnPredictionDashboard,
  getDriverReturnPrediction,
  predictAllActiveDrivers,
  predictDriverReturn,
  pruneOldPredictions,
} from '@/lib/delivery/driver-return-prediction';

async function getLocationId(req: NextRequest): Promise<string | null> {
  const override = req.nextUrl.searchParams.get('location_id');
  if (override) return override;

  const sb   = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('id', user.id)
    .maybeSingle();

  return (emp as { location_id: string | null } | null)?.location_id ?? null;
}

export async function GET(req: NextRequest) {
  const locationId = await getLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const action   = req.nextUrl.searchParams.get('action') ?? 'dashboard';
  const driverId = req.nextUrl.searchParams.get('driver_id');

  try {
    if (action === 'driver' && driverId) {
      const prediction = await getDriverReturnPrediction(driverId);
      return NextResponse.json({ ok: true, prediction });
    }

    // dashboard (default) oder list
    const dashboard = await getReturnPredictionDashboard(locationId);
    return NextResponse.json({ ok: true, ...dashboard });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const locationId = await getLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body   = await req.json().catch(() => ({})) as Record<string, unknown>;
  const action = String(body.action ?? '');

  try {
    if (action === 'predict') {
      const driverId = String(body.driver_id ?? '');
      if (!driverId) return NextResponse.json({ error: 'driver_id required' }, { status: 400 });
      const result = await predictDriverReturn(driverId, locationId);
      return NextResponse.json({ ok: true, result });
    }

    if (action === 'predict_all') {
      const result = await predictAllActiveDrivers(locationId);
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === 'prune') {
      const days   = Number(body.days ?? 3);
      const result = await pruneOldPredictions(days);
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
