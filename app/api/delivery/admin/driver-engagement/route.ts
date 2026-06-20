/**
 * GET  /api/delivery/admin/driver-engagement
 *   ?action=dashboard|config|leaderboard|profile&driver_id=
 *
 * POST /api/delivery/admin/driver-engagement
 *   body: { action: 'update_config'|'award_points'|'compute_leaderboard'|'weekly_reset'|'prune' }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import {
  getConfig,
  upsertConfig,
  getDashboard,
  getLeaderboard,
  getDriverEngagementProfile,
  computeWeeklyLeaderboard,
  computeWeeklyLeaderboardAllLocations,
  weeklyReset,
  weeklyResetAllLocations,
  awardPoints,
  pruneOldPoints,
  pruneOldLeaderboard,
} from '@/lib/delivery/driver-engagement';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const { searchParams } = new URL(req.url);
  const qsLocId = searchParams.get('location_id');
  if (qsLocId) return qsLocId;

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const svc = createServiceClient();
  const { data: emp } = await svc
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  return (emp?.location_id as string | null) ?? null;
}

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') ?? 'dashboard';

  if (action === 'config') {
    return NextResponse.json(await getConfig(locationId));
  }
  if (action === 'leaderboard') {
    const limit = Number(searchParams.get('limit') ?? '10');
    return NextResponse.json(await getLeaderboard(locationId, limit));
  }
  if (action === 'profile') {
    const driverId = searchParams.get('driver_id');
    if (!driverId) return NextResponse.json({ error: 'driver_id fehlt' }, { status: 400 });
    return NextResponse.json(await getDriverEngagementProfile(locationId, driverId));
  }
  return NextResponse.json(await getDashboard(locationId));
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const body = await req.json() as Record<string, unknown>;
  const action = body.action as string;

  const svc = createServiceClient();
  const { data: emp } = await svc
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  const locationId =
    (body.location_id as string | null) ??
    (emp?.location_id as string | null);
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  if (action === 'update_config') {
    const cfg = await upsertConfig(locationId, {
      isEnabled: body.is_enabled as boolean | undefined,
      pointsPerDelivery: body.points_per_delivery !== undefined ? Number(body.points_per_delivery) : undefined,
      pointsPerOnTime: body.points_per_on_time !== undefined ? Number(body.points_per_on_time) : undefined,
      pointsPerTopRating: body.points_per_top_rating !== undefined ? Number(body.points_per_top_rating) : undefined,
      weeklyResetDay: body.weekly_reset_day !== undefined ? Number(body.weekly_reset_day) : undefined,
      weeklyResetHourUtc: body.weekly_reset_hour_utc !== undefined ? Number(body.weekly_reset_hour_utc) : undefined,
    });
    return NextResponse.json({ ok: true, config: cfg });
  }

  if (action === 'award_points') {
    const driverId = body.driver_id as string;
    const points = Number(body.points ?? 0);
    const reason = (body.reason as string | undefined) ?? 'manual';
    if (!driverId || !points) return NextResponse.json({ error: 'driver_id und points erforderlich' }, { status: 400 });
    await awardPoints(locationId, driverId, points, reason);
    return NextResponse.json({ ok: true });
  }

  if (action === 'compute_leaderboard') {
    const result = await computeWeeklyLeaderboard(locationId);
    return NextResponse.json({ ok: true, ...result });
  }

  if (action === 'compute_leaderboard_all') {
    const result = await computeWeeklyLeaderboardAllLocations();
    return NextResponse.json({ ok: true, ...result });
  }

  if (action === 'weekly_reset') {
    const result = await weeklyReset(locationId);
    return NextResponse.json({ ok: true, ...result });
  }

  if (action === 'weekly_reset_all') {
    const result = await weeklyResetAllLocations();
    return NextResponse.json({ ok: true, ...result });
  }

  if (action === 'prune') {
    const [pts, lb] = await Promise.all([
      pruneOldPoints(Number(body.days ?? 90)),
      pruneOldLeaderboard(Number(body.weeks ?? 12)),
    ]);
    return NextResponse.json({ ok: true, points_pruned: pts.pruned, leaderboard_pruned: lb.pruned });
  }

  return NextResponse.json({ error: `Unbekannte Aktion: ${action}` }, { status: 400 });
}
