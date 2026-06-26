/**
 * GET /api/delivery/admin/gps-staleness?location_id=...
 *
 * GPS-Staleness-Monitor: Zeigt wie aktuell die GPS-Daten je Fahrer sind.
 *
 * Response:
 *   { ok, drivers: GpsDriver[], staleCount, criticalCount, totalOnlineCount, generatedAt }
 *
 * Multi-Tenant: alle Queries filtern location_id.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface GpsDriver {
  id: string;
  name: string;
  lastGpsAt: string | null;
  ageMin: number | null;
  status: 'fresh' | 'stale' | 'critical' | 'unknown';
}

async function resolveLocationId(userId: string): Promise<string | null> {
  const sb = await createClient();
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', userId)
    .maybeSingle();
  return (emp?.location_id as string) ?? null;
}

const STATUS_ORDER: Record<GpsDriver['status'], number> = {
  critical: 0,
  stale: 1,
  unknown: 2,
  fresh: 3,
};

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  let locationId = searchParams.get('location_id');
  if (!locationId) locationId = await resolveLocationId(user.id);
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const ssb = createServiceClient();
  const now = new Date();

  // Get all online drivers for this location
  const { data: onlineDrivers } = await ssb
    .from('mise_drivers')
    .select('id, name')
    .eq('location_id', locationId)
    .eq('is_online', true);

  if (!onlineDrivers || onlineDrivers.length === 0) {
    return NextResponse.json({
      ok: true,
      drivers: [],
      staleCount: 0,
      criticalCount: 0,
      totalOnlineCount: 0,
      generatedAt: now.toISOString(),
    });
  }

  // For each driver, get their latest GPS event
  const driverResults: GpsDriver[] = await Promise.all(
    (onlineDrivers as { id: string; name: string }[]).map(async (d) => {
      const { data: gpsEvents } = await ssb
        .from('driver_gps_events')
        .select('created_at')
        .eq('driver_id', d.id)
        .order('created_at', { ascending: false })
        .limit(1);

      const latestEvent = gpsEvents?.[0];
      if (!latestEvent) {
        return { id: d.id, name: d.name, lastGpsAt: null, ageMin: null, status: 'unknown' as const };
      }

      const lastGpsAt = latestEvent.created_at as string;
      const ageMs = now.getTime() - new Date(lastGpsAt).getTime();
      const ageMin = Math.round(ageMs / 60_000);

      let status: GpsDriver['status'];
      if (ageMin <= 2) {
        status = 'fresh';
      } else if (ageMin <= 5) {
        status = 'stale';
      } else {
        status = 'critical';
      }

      return { id: d.id, name: d.name, lastGpsAt, ageMin, status };
    }),
  );

  // Sort: critical first, then stale, then unknown, then fresh
  driverResults.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);

  const staleCount = driverResults.filter((d) => d.status === 'stale').length;
  const criticalCount = driverResults.filter((d) => d.status === 'critical').length;
  const totalOnlineCount = driverResults.length;

  return NextResponse.json({
    ok: true,
    drivers: driverResults,
    staleCount,
    criticalCount,
    totalOnlineCount,
    generatedAt: now.toISOString(),
  });
}
