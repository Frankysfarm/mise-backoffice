/**
 * GET /api/delivery/admin/driver-efficiency-ranking?location_id=...
 *
 * Multi-Fahrer-Tour-Effizienz-Ranking: Rankt Fahrer nach Effizienz
 * (Bestellungen/Stunde) mit 7-Tage-Trend.
 *
 * Response:
 *   { ok, drivers: DriverRankEntry[], avgOrdersPerHour: number, generatedAt: string }
 *
 * Multi-Tenant: alle Queries filtern location_id.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type EffTrend = 'up' | 'stable' | 'down';

export interface DriverRankEntry {
  rank: number;
  driverId: string;
  driverName: string;
  isOnline: boolean;
  ordersToday: number;
  hoursActiveToday: number;
  ordersPerHourToday: number;
  ordersPerHourAvg7d: number;
  trend: EffTrend;
  trendDelta: number;
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
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3_600_000);

  // Get all drivers for location
  const { data: allDrivers } = await ssb
    .from('mise_drivers')
    .select('id, name, is_online')
    .eq('location_id', locationId);

  if (!allDrivers || allDrivers.length === 0) {
    return NextResponse.json({ ok: true, drivers: [], avgOrdersPerHour: 0, generatedAt: now.toISOString() });
  }

  type Driver = { id: string; name: string; is_online: boolean };
  const drivers = allDrivers as Driver[];
  const driverIds = drivers.map((d) => d.id);

  // Today's delivered orders per driver
  const { data: todayOrders } = await ssb
    .from('customer_orders')
    .select('driver_id')
    .eq('location_id', locationId)
    .eq('status', 'geliefert')
    .in('driver_id', driverIds)
    .gte('created_at', todayStart.toISOString());

  const todayOrderMap = new Map<string, number>();
  for (const o of todayOrders ?? []) {
    const dId = o.driver_id as string;
    todayOrderMap.set(dId, (todayOrderMap.get(dId) ?? 0) + 1);
  }

  // Today's shift hours
  const { data: todayShifts } = await ssb
    .from('driver_shifts')
    .select('driver_id, started_at, ended_at')
    .eq('location_id', locationId)
    .in('driver_id', driverIds)
    .gte('started_at', todayStart.toISOString());

  type Shift = { driver_id: string; started_at: string; ended_at: string | null };
  const todayShiftsMap = new Map<string, number>();
  for (const s of (todayShifts ?? []) as Shift[]) {
    const endRaw = s.ended_at ?? now.toISOString();
    const hours = Math.max(0.5, (new Date(endRaw).getTime() - new Date(s.started_at).getTime()) / 3_600_000);
    todayShiftsMap.set(s.driver_id, (todayShiftsMap.get(s.driver_id) ?? 0) + hours);
  }

  // 7-day historical: daily orders and shift hours per driver
  const { data: histOrders } = await ssb
    .from('customer_orders')
    .select('driver_id, created_at')
    .eq('location_id', locationId)
    .eq('status', 'geliefert')
    .in('driver_id', driverIds)
    .gte('created_at', sevenDaysAgo.toISOString())
    .lt('created_at', todayStart.toISOString());

  const histOrderMap = new Map<string, number>();
  for (const o of histOrders ?? []) {
    const dId = o.driver_id as string;
    histOrderMap.set(dId, (histOrderMap.get(dId) ?? 0) + 1);
  }

  const { data: histShifts } = await ssb
    .from('driver_shifts')
    .select('driver_id, started_at, ended_at')
    .eq('location_id', locationId)
    .in('driver_id', driverIds)
    .gte('started_at', sevenDaysAgo.toISOString())
    .lt('started_at', todayStart.toISOString());

  const histShiftMap = new Map<string, number>();
  for (const s of (histShifts ?? []) as Shift[]) {
    const endRaw = s.ended_at ?? s.started_at;
    const hours = Math.max(0, (new Date(endRaw).getTime() - new Date(s.started_at).getTime()) / 3_600_000);
    histShiftMap.set(s.driver_id, (histShiftMap.get(s.driver_id) ?? 0) + hours);
  }

  // Build ranking
  const rawEntries = drivers.map((driver) => {
    const ordersToday = todayOrderMap.get(driver.id) ?? 0;
    const hoursToday = todayShiftsMap.get(driver.id) ?? 0.5;
    const ordersPerHourToday = Math.round((ordersToday / hoursToday) * 10) / 10;

    const histOrdsTotal = histOrderMap.get(driver.id) ?? 0;
    const histHours = histShiftMap.get(driver.id) ?? 0;
    const ordersPerHourAvg7d = histHours > 0 ? Math.round((histOrdsTotal / histHours) * 10) / 10 : 0;

    const trendDelta = Math.round((ordersPerHourToday - ordersPerHourAvg7d) * 10) / 10;
    const trend: EffTrend = trendDelta > 0.3 ? 'up' : trendDelta < -0.3 ? 'down' : 'stable';

    return { driver, ordersToday, hoursToday, ordersPerHourToday, ordersPerHourAvg7d, trendDelta, trend };
  });

  // Sort by ordersPerHourToday descending, only include drivers with activity or online
  const ranked = rawEntries
    .filter((e) => e.ordersToday > 0 || e.driver.is_online)
    .sort((a, b) => b.ordersPerHourToday - a.ordersPerHourToday);

  const avgOrdersPerHour =
    ranked.length > 0
      ? Math.round((ranked.reduce((s, e) => s + e.ordersPerHourToday, 0) / ranked.length) * 10) / 10
      : 0;

  const drivers_result: DriverRankEntry[] = ranked.map((e, idx) => ({
    rank: idx + 1,
    driverId: e.driver.id,
    driverName: e.driver.name,
    isOnline: e.driver.is_online,
    ordersToday: e.ordersToday,
    hoursActiveToday: Math.round(e.hoursToday * 10) / 10,
    ordersPerHourToday: e.ordersPerHourToday,
    ordersPerHourAvg7d: e.ordersPerHourAvg7d,
    trend: e.trend,
    trendDelta: e.trendDelta,
  }));

  return NextResponse.json({ ok: true, drivers: drivers_result, avgOrdersPerHour, generatedAt: now.toISOString() });
}
