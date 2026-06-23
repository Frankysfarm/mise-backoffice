/**
 * GET  /api/delivery/admin/driver-leaderboard
 *   ?location_id=...&period=today|week|month&limit=20[&format=compare]
 *   → LeaderboardEntry[] + meta
 *   → format=compare: { top: DriverMetrics[], bottom: DriverMetrics[] }
 *
 * POST /api/delivery/admin/driver-leaderboard
 *   body: { location_id, date? (ISO YYYY-MM-DD) }
 *   → Snapshot für alle Fahrer dieser Location berechnen + speichern
 *
 * Nur für eingeloggte Admins.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  getLeaderboard,
  snapshotAllDriversForLocation,
  type LeaderboardPeriod,
} from '@/lib/delivery/driver-performance';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getLocationId(
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

  const locationId = await getLocationId(sb, searchParams.get('location_id'));
  if (!locationId) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });

  const period = (searchParams.get('period') ?? 'week') as LeaderboardPeriod;
  if (!['today', 'week', 'month'].includes(period)) {
    return NextResponse.json({ error: 'Ungültiger period-Wert' }, { status: 400 });
  }
  const limit = Math.min(Number(searchParams.get('limit') ?? 20), 50);

  const entries = await getLeaderboard(locationId, period, limit);

  const format = searchParams.get('format');
  if (format === 'compare') {
    const maxStops    = entries.reduce((m, e) => Math.max(m, e.stopsCompleted), 1);
    const maxEarnings = entries.reduce((m, e) => Math.max(m, e.earningsEur), 0.01);

    const withScore = entries.map(e => {
      const onTimePct   = Math.round((e.onTimeRate ?? 0) * 100);
      const toursPct    = Math.round((e.stopsCompleted / maxStops) * 100);
      const earningsPct = Math.round((e.earningsEur / maxEarnings) * 100);
      const score       = Math.round(onTimePct * 0.5 + toursPct * 0.3 + earningsPct * 0.2);
      return {
        name:       e.driverName ?? 'Unbekannt',
        deliveries: e.stopsCompleted,
        onTimePct,
        avgMinutes: Math.round(e.avgDeliveryMin ?? 0),
        tipsEur:    Math.round(e.earningsEur * 100) / 100,
        score,
      };
    }).sort((a, b) => b.score - a.score);

    const top    = withScore.slice(0, 3);
    const bottom = withScore.length > 3 ? [...withScore].reverse().slice(0, 3) : [];
    return NextResponse.json({ top, bottom });
  }

  return NextResponse.json({
    period,
    total: entries.length,
    entries,
    generated_at: new Date().toISOString(),
  });
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  let body: { location_id?: string; date?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Ungültiger Body' }, { status: 400 }); }

  const locationId = body.location_id;
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const date = body.date ? new Date(body.date) : new Date();
  if (isNaN(date.getTime())) {
    return NextResponse.json({ error: 'Ungültiges Datum' }, { status: 400 });
  }

  const result = await snapshotAllDriversForLocation(locationId, date);

  return NextResponse.json({
    ok: true,
    date: date.toISOString().slice(0, 10),
    ...result,
  });
}
