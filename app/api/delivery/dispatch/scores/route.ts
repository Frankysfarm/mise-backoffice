/**
 * GET /api/delivery/dispatch/scores
 *
 * Liefert Echtzeit-Dispatch-Readiness-Scores für alle aktiven Fahrer einer Location.
 * Genutzt von DispatchLiveScoreBoard (dispatch-live-score-board.tsx).
 *
 * Response: Array von { name, vehicle, score } sortiert nach score DESC.
 *
 * Score-Logik (0–100):
 *  - Base:       driver_composite_scores (letzte Woche) oder 70 wenn kein Verlauf
 *  - Lastabzug:  (current_capacity / max_capacity) × 20 Punkte
 *  - Status:     idle +5 | returning +2 | assigned 0 | at_restaurant -3 | en_route -8
 *  - Clamp:      [0, 100]
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface DriverRow {
  id: string;
  name: string | null;
  vehicle: string | null;
  state: string | null;
  current_capacity: number | null;
  max_capacity: number | null;
  location_id: string | null;
}

interface ScoreRow {
  driver_id: string;
  composite_score: number;
}

const STATE_BONUS: Record<string, number> = {
  idle:           5,
  returning:      2,
  assigned:       0,
  at_restaurant: -3,
  en_route:      -8,
};

function computeLiveScore(
  baseScore: number,
  currentCapacity: number,
  maxCapacity: number,
  state: string,
): number {
  const loadRatio  = maxCapacity > 0 ? currentCapacity / maxCapacity : 0;
  const loadPenalty = Math.round(loadRatio * 20);
  const stateBonus  = STATE_BONUS[state] ?? 0;
  return Math.min(100, Math.max(0, baseScore - loadPenalty + stateBonus));
}

export async function GET(req: NextRequest) {
  // Auth — authenticated employee
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  // Resolve location_id from employee profile
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .single();

  const locationId = emp?.location_id as string | null
    ?? (new URL(req.url).searchParams.get('location_id'));

  if (!locationId) {
    return NextResponse.json({ error: 'Kein Standort zugeordnet' }, { status: 400 });
  }

  const svc = createServiceClient();

  // Aktive Fahrer der Location laden
  const { data: drivers, error: driverErr } = await svc
    .from('mise_drivers')
    .select('id, name, vehicle, state, current_capacity, max_capacity, location_id')
    .eq('location_id', locationId)
    .eq('active', true)
    .in('state', ['idle', 'assigned', 'at_restaurant', 'en_route', 'returning'])
    .order('name', { ascending: true });

  if (driverErr) {
    return NextResponse.json({ error: driverErr.message }, { status: 500 });
  }

  if (!drivers || drivers.length === 0) {
    return NextResponse.json([]);
  }

  const driverRows = drivers as DriverRow[];
  const driverIds  = driverRows.map((d) => d.id);

  // Composite-Scores der letzten Woche laden (best effort)
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 7);

  const { data: scoreRows } = await svc
    .from('driver_composite_scores')
    .select('driver_id, composite_score')
    .eq('location_id', locationId)
    .eq('period', 'week')
    .gte('period_start', since.toISOString().slice(0, 10))
    .in('driver_id', driverIds)
    .order('period_start', { ascending: false });

  // Neuester Score je Fahrer (erste Zeile nach ORDER BY DESC)
  const scoreMap = new Map<string, number>();
  for (const row of (scoreRows ?? []) as ScoreRow[]) {
    if (!scoreMap.has(row.driver_id)) {
      scoreMap.set(row.driver_id, row.composite_score);
    }
  }

  // Ergebnis zusammenbauen
  const result = driverRows
    .map((d) => {
      const baseScore      = scoreMap.get(d.id) ?? 70;
      const currentCap     = d.current_capacity ?? 0;
      const maxCap         = d.max_capacity ?? 1;
      const state          = d.state ?? 'idle';
      const score          = computeLiveScore(baseScore, currentCap, maxCap, state);
      const vehicle: 'bike' | 'car' =
        d.vehicle === 'car' ? 'car' : 'bike';
      const name = (d.name ?? 'Fahrer').trim() || 'Fahrer';

      return { name, vehicle, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  return NextResponse.json(result);
}
