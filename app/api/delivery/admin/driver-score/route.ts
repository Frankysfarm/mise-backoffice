/**
 * GET  /api/delivery/admin/driver-score
 *   ?location_id=...&action=leaderboard|history|detail&period=week|month&limit=20
 *   action=leaderboard → ScoreLeaderboardEntry[] mit Composite-Score-Rangliste
 *   action=history     → DriverScoreHistoryRow[] (last N weeks)
 *   action=detail      → CompositeScoreResult für einen Fahrer
 *
 * POST /api/delivery/admin/driver-score
 *   body: { location_id, period?, action? }
 *   action=recompute (default) → Scores für alle Fahrer neu berechnen
 *   action=snapshot            → Snapshot in driver_score_history speichern
 *
 * Auth: eingeloggte Mitarbeiter (location_id wird aus session gelesen falls nicht angegeben)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import {
  getScoreLeaderboard,
  getDriverScoreDetail,
  computeAndSaveScoresForLocation,
  getDriverScoreHistory,
  snapshotDriverScoreHistory,
  type ScorePeriod,
} from '@/lib/delivery/driver-score';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(
  sb: Awaited<ReturnType<typeof createClient>>,
  queryLocationId: string | null,
): Promise<string | null> {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  if (queryLocationId) return queryLocationId;
  const svc = createServiceClient();
  const { data: emp } = await svc
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .single();
  return (emp?.location_id as string) ?? null;
}

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { searchParams } = new URL(req.url);

  const locationId = await resolveLocationId(sb, searchParams.get('location_id'));
  if (!locationId) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });

  const action = searchParams.get('action') ?? 'leaderboard';

  if (action === 'history') {
    const weeks = Math.min(Number(searchParams.get('weeks') ?? 8), 16);
    const driverIdParam = searchParams.get('driver_id');
    const driverIds = driverIdParam ? [driverIdParam] : undefined;
    const rows = await getDriverScoreHistory(locationId, weeks, driverIds);
    return NextResponse.json({ weeks, total: rows.length, rows, generated_at: new Date().toISOString() });
  }

  if (action === 'detail') {
    const driverId = searchParams.get('driver_id');
    if (!driverId) return NextResponse.json({ error: 'driver_id fehlt' }, { status: 400 });
    const period = (searchParams.get('period') ?? 'week') as ScorePeriod;
    const detail = await getDriverScoreDetail(driverId, locationId, period);
    return NextResponse.json({ detail, generated_at: new Date().toISOString() });
  }

  // action=live → DriverScore[] format for DispatchFahrerScorePerformanceHub
  if (action === 'live') {
    const entries = await getScoreLeaderboard(locationId, 'week', 20);
    const live = entries.map((e) => ({
      driver_id: e.driverId,
      driver_name: e.driverName ?? 'Unbekannt',
      score: Math.round(e.compositeScore),
      sub_scores: {
        punctuality: Math.round((e.fPunctuality / 30) * 100),
        completion: Math.round(((e.fActivity + e.fVolume) / 15) * 100),
        customer_rating: Math.round(((e.fRating / 25) * 4 + 1) * 10) / 10,
        efficiency: Math.round((e.fEfficiency / 15) * 100),
      },
    }));
    return NextResponse.json(live);
  }

  // default: leaderboard
  const period = (searchParams.get('period') ?? 'week') as ScorePeriod;
  if (!['week', 'month'].includes(period)) {
    return NextResponse.json({ error: 'period muss week oder month sein' }, { status: 400 });
  }
  const limit = Math.min(Number(searchParams.get('limit') ?? 20), 50);
  const entries = await getScoreLeaderboard(locationId, period, limit);
  return NextResponse.json({ period, total: entries.length, entries, generated_at: new Date().toISOString() });
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  let body: { location_id?: string; period?: string; action?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Ungültiger Body' }, { status: 400 }); }

  const locationId = body.location_id;
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  if (body.action === 'snapshot') {
    const result = await snapshotDriverScoreHistory(locationId);
    return NextResponse.json({ ok: true, ...result });
  }

  const period = (body.period ?? 'week') as ScorePeriod;
  if (!['week', 'month'].includes(period)) {
    return NextResponse.json({ error: 'period muss week oder month sein' }, { status: 400 });
  }

  const result = await computeAndSaveScoresForLocation(locationId, period);

  return NextResponse.json({ ok: true, period, ...result });
}
