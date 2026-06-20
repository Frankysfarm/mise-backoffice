/**
 * GET /api/delivery/driver/my-performance
 *   ?period=today|week|month&days=14
 *
 * Persönliche Performance-Daten für den eingeloggten Fahrer:
 *  - Rank + Gesamtzahl Fahrer im aktuellen Leaderboard
 *  - Persönliche Trend-Historie (letzte N Tage Snapshots)
 *
 * Auth: muss als Fahrer eingeloggt sein (mise_drivers.auth_user_id = user.id)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  getDriverHistory,
  getDriverRank,
  type LeaderboardPeriod,
} from '@/lib/delivery/driver-performance';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const period = (searchParams.get('period') ?? 'week') as LeaderboardPeriod;
  const days   = Math.min(Number(searchParams.get('days') ?? 14), 90);

  const svc = createServiceClient();

  // Fahrer-ID + Location-ID auflösen
  const { data: driver } = await svc
    .from('mise_drivers')
    .select('id')
    .eq('auth_user_id', user.id)
    .single();

  if (!driver) return NextResponse.json({ error: 'Kein Fahrer-Profil gefunden' }, { status: 404 });
  const driverId = driver.id as string;

  const { data: emp } = await svc
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .single();

  if (!emp?.location_id) return NextResponse.json({ error: 'Keine Location zugewiesen' }, { status: 404 });
  const locationId = emp.location_id as string;

  const since1h = new Date(Date.now() - 3_600_000).toISOString();
  const [history, rankData, latestSnapshot] = await Promise.all([
    getDriverHistory(driverId, locationId, days),
    getDriverRank(driverId, locationId, period),
    svc
      .from('driver_live_score_snapshots')
      .select('live_score')
      .eq('driver_id', driverId)
      .gte('snapshot_at', since1h)
      .order('snapshot_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const liveScore = (latestSnapshot.data as Record<string, unknown> | null)?.live_score as number | null ?? null;

  return NextResponse.json({
    driverId,
    locationId,
    period,
    rank:    rankData?.rank  ?? null,
    total:   rankData?.total ?? null,
    // rankData object for EchtzeitLeistungsAnzeige component
    rankData: rankData && liveScore !== null
      ? { rank: rankData.rank, total: rankData.total, score: liveScore }
      : null,
    history,
  });
}
