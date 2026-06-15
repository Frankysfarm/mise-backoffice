/**
 * GET+POST /api/delivery/admin/driver-streaks
 *
 * Phase 194 — Fahrer-Streak-Tracking V2
 *
 * GET  ?action=dashboard                          → StreakDashboard
 * GET  ?action=leaderboard&limit=20               → StreakLeaderboardEntry[]
 * GET  ?action=milestones&limit=50                → StreakEvent[]
 * GET  ?action=driver&driverId=...                → DriverStreak | null
 * GET  ?action=events&driverId=...&limit=30       → StreakEvent[]
 * GET  ?action=config                             → StreakConfig
 * POST { action: 'save_config', ...StreakConfig } → StreakConfig
 * POST { action: 'record', driverId, orderId, wasOnTime } → RecordDeliveryResult
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  getStreakDashboard,
  getStreakLeaderboard,
  getStreakMilestones,
  getDriverStreak,
  getDriverStreakEvents,
  getStreakConfig,
  upsertStreakConfig,
  recordDelivery,
  type StreakConfig,
} from '@/lib/delivery/driver-streaks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getLocationId(req: NextRequest): Promise<string | null> {
  const sb = createServiceClient();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return null;
  const { data: emp } = await sb
    .from('employees')
    .select('location_id, role')
    .eq('user_id', session.user.id)
    .maybeSingle();
  if (!emp?.location_id) return null;
  if (!['manager', 'owner', 'admin', 'superadmin'].includes(emp.role as string)) return null;
  return emp.location_id as string;
}

export async function GET(req: NextRequest) {
  const locationId = await getLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') ?? 'dashboard';

  try {
    if (action === 'dashboard') {
      return NextResponse.json(await getStreakDashboard(locationId));
    }
    if (action === 'leaderboard') {
      const limit = Math.min(Number(searchParams.get('limit') ?? '20'), 100);
      return NextResponse.json(await getStreakLeaderboard(locationId, limit));
    }
    if (action === 'milestones') {
      const limit = Math.min(Number(searchParams.get('limit') ?? '50'), 200);
      return NextResponse.json(await getStreakMilestones(locationId, limit));
    }
    if (action === 'driver') {
      const driverId = searchParams.get('driverId');
      if (!driverId) return NextResponse.json({ error: 'driverId fehlt' }, { status: 400 });
      return NextResponse.json(await getDriverStreak(driverId, locationId));
    }
    if (action === 'events') {
      const driverId = searchParams.get('driverId');
      if (!driverId) return NextResponse.json({ error: 'driverId fehlt' }, { status: 400 });
      const limit = Math.min(Number(searchParams.get('limit') ?? '30'), 100);
      return NextResponse.json(await getDriverStreakEvents(driverId, limit));
    }
    if (action === 'config') {
      return NextResponse.json(await getStreakConfig(locationId));
    }
    return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const locationId = await getLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json() as Record<string, unknown>;
    const action = body.action as string;

    if (action === 'save_config') {
      const cfg: StreakConfig = {
        locationId,
        multiplierTiers:   body.multiplierTiers as StreakConfig['multiplierTiers'],
        milestoneBonusEur: body.milestoneBonusEur as StreakConfig['milestoneBonusEur'],
        enabled:           body.enabled as boolean,
      };
      return NextResponse.json(await upsertStreakConfig(cfg));
    }

    if (action === 'record') {
      const { driverId, orderId, wasOnTime } = body as {
        driverId: string;
        orderId: string;
        wasOnTime: boolean;
      };
      const result = await recordDelivery(locationId, driverId, orderId, wasOnTime);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
