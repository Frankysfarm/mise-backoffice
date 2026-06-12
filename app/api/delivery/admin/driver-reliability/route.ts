/**
 * GET /api/delivery/admin/driver-reliability
 *   → Zuverlässigkeits-Leaderboard + KPI-Summary
 *
 * GET /api/delivery/admin/driver-reliability?action=stats
 *   → nur KPI-Summary
 *
 * GET /api/delivery/admin/driver-reliability?action=history&driver_id=<uuid>
 *   → Ereignis-Verlauf eines einzelnen Fahrers
 *
 * Query-Params:
 *   action    — 'leaderboard' (default) | 'stats' | 'history'
 *   driver_id — UUID (nur für action=history)
 *   limit     — 1–50, default 25
 *
 * Auth: Eingeloggter Admin (tenant_id via employees-Tabelle)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getReliabilityLeaderboard,
  getDriverReliabilityHistory,
  getReliabilityStats,
} from '@/lib/delivery/driver-reliability';

export const runtime  = 'nodejs';
export const dynamic  = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getLocationId(req: NextRequest): Promise<string | null> {
  const qLoc = new URL(req.url).searchParams.get('location_id');
  if (qLoc && UUID_RE.test(qLoc)) return qLoc;

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data: emp } = await sb
    .from('employees')
    .select('tenant_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  return (emp?.tenant_id as string | null) ?? null;
}

export async function GET(req: NextRequest) {
  const locationId = await getLocationId(req);
  if (!locationId) {
    return NextResponse.json({ error: 'Nicht eingeloggt oder location_id fehlt' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const action   = searchParams.get('action') ?? 'leaderboard';
  const driverId = searchParams.get('driver_id');
  const limit    = Math.min(50, Math.max(1, Number(searchParams.get('limit') ?? 25)));

  // ── Ereignis-Verlauf eines Fahrers ──────────────────────────────────────────
  if (action === 'history') {
    if (!driverId || !UUID_RE.test(driverId)) {
      return NextResponse.json({ error: 'driver_id fehlt oder ungültig' }, { status: 400 });
    }
    const history = await getDriverReliabilityHistory(driverId, locationId, limit);
    return NextResponse.json({ driver_id: driverId, history, count: history.length });
  }

  // ── Nur Stats ───────────────────────────────────────────────────────────────
  if (action === 'stats') {
    const stats = await getReliabilityStats(locationId);
    return NextResponse.json({ stats });
  }

  // ── Standard: Leaderboard + Stats ───────────────────────────────────────────
  const [leaderboard, stats] = await Promise.all([
    getReliabilityLeaderboard(locationId, limit),
    getReliabilityStats(locationId),
  ]);

  return NextResponse.json({
    leaderboard,
    stats,
    count:        leaderboard.length,
    generated_at: new Date().toISOString(),
  });
}
