/**
 * GET  /api/delivery/admin/driver-performance-realtime
 * POST /api/delivery/admin/driver-performance-realtime  { action: 'snapshot' }
 *
 * Echtzeit-Fahrer-Performance-Dashboard (Phase 310):
 * - GET: Live-Score je Fahrer + Woche-vs-Vorwoche-Trend für eine Location
 * - GET ?driver_id=...&hours=8: Trend-Chart-Punkte für einen einzelnen Fahrer
 * - POST action=snapshot: Live-Score-Snapshots aller Fahrer speichern (Cron-Trigger)
 *
 * Auth: eingeloggter Mitarbeiter (location_id aus employees-Tabelle)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import {
  getDriverPerformanceRealtime,
  getDriverLiveScoreTrend,
  saveDriverLiveScoreSnapshots,
  saveDriverLiveScoreSnapshotsAllLocations,
  pruneDriverLiveScoreSnapshots,
} from '@/lib/delivery/driver-performance-realtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocation(req: NextRequest): Promise<string | null> {
  const qsLoc = req.nextUrl.searchParams.get('location_id');
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  if (qsLoc) {
    const svc = createServiceClient();
    const { data: emp } = await svc
      .from('employees')
      .select('tenant_id')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    if (emp?.tenant_id) return qsLoc;
  }

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  return (emp?.location_id as string | null) ?? null;
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocation(req);
  if (!locationId) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const driverId = searchParams.get('driver_id');
  const hours    = Math.min(Number(searchParams.get('hours') ?? 8), 48);

  // Trend-Chart für einzelnen Fahrer
  if (driverId) {
    const trend = await getDriverLiveScoreTrend(driverId, hours);
    return NextResponse.json({ driverId, hours, trend });
  }

  // Vollständiges Dashboard
  const dashboard = await getDriverPerformanceRealtime(locationId);
  return NextResponse.json(dashboard);
}

export async function POST(req: NextRequest) {
  // Cron-Auth oder Admin-User
  const authHeader = req.headers.get('authorization');
  const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;

  let locationId: string | null = null;
  if (!isCron) {
    locationId = await resolveLocation(req);
    if (!locationId) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as { action?: string; all_locations?: boolean };
  const action = body.action ?? 'snapshot';

  if (action === 'snapshot') {
    if (isCron || body.all_locations) {
      const result = await saveDriverLiveScoreSnapshotsAllLocations();
      await pruneDriverLiveScoreSnapshots().catch(() => {});
      return NextResponse.json({ ok: true, ...result });
    }
    if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });
    const snapshots = await saveDriverLiveScoreSnapshots(locationId);
    return NextResponse.json({ ok: true, locationId, snapshots });
  }

  return NextResponse.json({ error: `Unbekannte Action: ${action}` }, { status: 400 });
}
