import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import {
  getPerformanceDashboard,
  getPerformanceTrend,
  snapshotPerformanceScore,
  snapshotAllLocations,
  pruneOldPerformanceScores,
} from '@/lib/delivery/performance-score';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const qsLoc = req.nextUrl.searchParams.get('location_id');
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  if (qsLoc) {
    // Superadmin override
    const { data: emp } = await sb.from('employees')
      .select('tenant_id')
      .eq('id', user.id)
      .maybeSingle();
    if (emp?.tenant_id) return qsLoc;
  }

  const { data: emp } = await sb.from('employees')
    .select('location_id')
    .eq('id', user.id)
    .maybeSingle();
  return emp?.location_id ?? null;
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const action = req.nextUrl.searchParams.get('action') ?? 'dashboard';
  const days   = parseInt(req.nextUrl.searchParams.get('days') ?? '30', 10);

  try {
    if (action === 'trend') {
      const trend = await getPerformanceTrend(locationId, days);
      return NextResponse.json({ trend });
    }

    if (action === 'all') {
      const sb = createServiceClient();
      const { data } = await sb
        .from('v_performance_score_ranking')
        .select('location_id, location_name, overall_score, grade, live_rank, total_locations, score_date')
        .order('live_rank', { ascending: true });
      return NextResponse.json({ ranking: data ?? [] });
    }

    // default: dashboard
    const dashboard = await getPerformanceDashboard(locationId);
    return NextResponse.json(dashboard);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
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
      const result = await pruneOldPerformanceScores(Number(body.days_to_keep ?? 90));
      return NextResponse.json({ ok: true, ...result });
    }

    // default: snapshot current location
    const snap = await snapshotPerformanceScore(locationId, body.date as string | undefined);
    return NextResponse.json({ ok: true, snap });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
