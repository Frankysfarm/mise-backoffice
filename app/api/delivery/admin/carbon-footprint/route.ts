import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getCarbonDashboard,
  getDriverLeaderboard,
  getCo2Trend,
  snapshotCarbonFootprint,
  pruneCo2Snapshots,
} from '@/lib/delivery/carbon-footprint';

export const dynamic = 'force-dynamic';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const qp = req.nextUrl.searchParams.get('location_id');
  if (qp) return qp;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  return emp?.location_id ?? null;
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const action = req.nextUrl.searchParams.get('action') ?? 'dashboard';

  try {
    if (action === 'leaderboard') {
      const leaderboard = await getDriverLeaderboard(locationId);
      return NextResponse.json({ ok: true, leaderboard });
    }
    if (action === 'trend') {
      const trend = await getCo2Trend(locationId);
      return NextResponse.json({ ok: true, trend });
    }
    // default: dashboard
    const dashboard = await getCarbonDashboard(locationId);
    return NextResponse.json({ ok: true, dashboard });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { action?: string; days_to_keep?: number };
  const action = body.action ?? 'snapshot';

  try {
    if (action === 'prune') {
      const deleted = await pruneCo2Snapshots(body.days_to_keep ?? 90);
      return NextResponse.json({ ok: true, deleted });
    }
    // default: snapshot
    const result = await snapshotCarbonFootprint(locationId);
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
