/**
 * GET  /api/delivery/admin/punctuality-coach
 *   ?action=dashboard                           → CoachingDashboard (all drivers)
 *   ?action=report&driver_id=<uuid>&days=14     → DriverCoachingReport (single driver)
 *
 * POST /api/delivery/admin/punctuality-coach
 *   { action: 'snapshot', driver_id?: string, days?: number }
 *     driver_id omitted → snapshot all active drivers for the location
 *     driver_id provided → snapshot only that driver
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getPunctualityCoachDashboard,
  getDriverCoachingReport,
  snapshotDriverCoaching,
  snapshotAllDriversCoaching,
} from '@/lib/delivery/punctuality-coach';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(userId: string, explicitId: string | null): Promise<string | null> {
  if (explicitId) return explicitId;
  const sb = await createClient();
  const { data } = await sb
    .from('mise_staff')
    .select('location_id')
    .eq('auth_user_id', userId)
    .limit(1)
    .single();
  return (data as { location_id: string } | null)?.location_id ?? null;
}

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const action     = searchParams.get('action') ?? 'dashboard';
  const locationId = await resolveLocationId(user.id, searchParams.get('location_id'));
  if (!locationId) return NextResponse.json({ error: 'location_id erforderlich' }, { status: 400 });

  try {
    if (action === 'dashboard') {
      const dashboard = await getPunctualityCoachDashboard(locationId);
      return NextResponse.json(dashboard);
    }

    if (action === 'report') {
      const driverId = searchParams.get('driver_id');
      if (!driverId) return NextResponse.json({ error: 'driver_id erforderlich für report' }, { status: 400 });
      const days = Math.min(Number(searchParams.get('days') ?? 14), 90);
      const report = await getDriverCoachingReport(locationId, driverId, days);
      return NextResponse.json(report);
    }

    return NextResponse.json({ error: `Unbekannte action: ${action}` }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[punctuality-coach GET]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 });
  }

  const { action, driver_id, days, location_id } = body as {
    action?: string;
    driver_id?: string;
    days?: number;
    location_id?: string;
  };

  if (action !== 'snapshot') {
    return NextResponse.json({ error: `Unbekannte action: ${String(action)}` }, { status: 400 });
  }

  const locationId = await resolveLocationId(user.id, location_id ?? null);
  if (!locationId) return NextResponse.json({ error: 'location_id erforderlich' }, { status: 400 });

  const analysisDays = Math.min(Number(days ?? 14), 90);

  try {
    if (driver_id) {
      const profile = await snapshotDriverCoaching(locationId, driver_id, analysisDays);
      return NextResponse.json({ ok: true, profile });
    }

    const result = await snapshotAllDriversCoaching(locationId, analysisDays);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[punctuality-coach POST]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
