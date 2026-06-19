import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getLocationHealthDashboard,
  getLocationHealthTrend,
  snapshotLocationHealthScore,
  snapshotAllLocations,
  pruneOldHealthScores,
} from '@/lib/delivery/location-health-score';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const qsLoc = req.nextUrl.searchParams.get('location_id');
  const sb    = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  if (qsLoc) {
    const { data: emp } = await sb.from('employees')
      .select('tenant_id').eq('id', user.id).maybeSingle();
    if (emp?.tenant_id) return qsLoc;
  }

  const { data: emp } = await sb.from('employees')
    .select('location_id').eq('id', user.id).maybeSingle();
  return (emp?.location_id as string | null) ?? null;
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const action = req.nextUrl.searchParams.get('action') ?? 'dashboard';
  const days   = parseInt(req.nextUrl.searchParams.get('days') ?? '30', 10);

  try {
    if (action === 'trend') {
      const trend = await getLocationHealthTrend(locationId, days);
      return NextResponse.json({ trend });
    }

    // default: dashboard
    const dashboard = await getLocationHealthDashboard(locationId);
    return NextResponse.json(dashboard);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('location_health_scores')) {
      return NextResponse.json({ latest: null, trend: [], ranking: [], recommendations: [], migration_pending: true });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body   = await req.json().catch(() => ({})) as Record<string, unknown>;
  const action = (body.action as string) ?? 'snapshot';

  try {
    if (action === 'snapshot_all') {
      const result = await snapshotAllLocations(body.date as string | undefined);
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === 'prune') {
      const result = await pruneOldHealthScores(Number(body.days_to_keep ?? 90));
      return NextResponse.json({ ok: true, ...result });
    }

    // default: snapshot current location
    const snapshot = await snapshotLocationHealthScore(locationId, body.date as string | undefined);
    return NextResponse.json({ ok: true, snapshot });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
