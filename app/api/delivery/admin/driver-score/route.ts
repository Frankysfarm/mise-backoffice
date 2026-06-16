/**
 * GET  /api/delivery/admin/driver-score
 *   ?location_id=...&period=week|month&limit=20
 *   → ScoreLeaderboardEntry[] mit Composite-Score-Rangliste
 *
 * POST /api/delivery/admin/driver-score
 *   body: { location_id, period?: 'week'|'month' }
 *   → Scores für alle Fahrer dieser Location neu berechnen + speichern
 *
 * Auth: eingeloggte Mitarbeiter (location_id wird aus session gelesen falls nicht angegeben)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import {
  getScoreLeaderboard,
  computeAndSaveScoresForLocation,
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

  const period = (searchParams.get('period') ?? 'week') as ScorePeriod;
  if (!['week', 'month'].includes(period)) {
    return NextResponse.json({ error: 'period muss week oder month sein' }, { status: 400 });
  }
  const limit = Math.min(Number(searchParams.get('limit') ?? 20), 50);

  const entries = await getScoreLeaderboard(locationId, period, limit);

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

  let body: { location_id?: string; period?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Ungültiger Body' }, { status: 400 }); }

  const locationId = body.location_id;
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const period = (body.period ?? 'week') as ScorePeriod;
  if (!['week', 'month'].includes(period)) {
    return NextResponse.json({ error: 'period muss week oder month sein' }, { status: 400 });
  }

  const result = await computeAndSaveScoresForLocation(locationId, period);

  return NextResponse.json({ ok: true, period, ...result });
}
