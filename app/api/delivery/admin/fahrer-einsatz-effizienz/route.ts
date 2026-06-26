/**
 * GET /api/delivery/admin/fahrer-einsatz-effizienz?location_id=...
 *
 * Fahrer-Einsatz-Effizienz: Bestellungen pro Stunde je online Fahrer.
 *
 * Response:
 *   { ok, drivers: DriverEff[], avgOrdersPerHour: number, generatedAt: string }
 *
 * Multi-Tenant: alle Queries filtern location_id.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface DriverEff {
  id: string;
  name: string;
  ordersToday: number;
  hoursActive: number;
  ordersPerHour: number;
  status: 'hoch' | 'normal' | 'niedrig';
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

  // Get all online drivers for this location
  const { data: onlineDrivers } = await ssb
    .from('mise_drivers')
    .select('id, name')
    .eq('location_id', locationId)
    .eq('is_online', true);

  if (!onlineDrivers || onlineDrivers.length === 0) {
    return NextResponse.json({ ok: true, drivers: [], avgOrdersPerHour: 0, generatedAt: now.toISOString() });
  }

  const driverIds = onlineDrivers.map((d: { id: string; name: string }) => d.id);

  // Get today's delivered orders per driver
  const { data: orders } = await ssb
    .from('customer_orders')
    .select('driver_id')
    .eq('location_id', locationId)
    .eq('status', 'geliefert')
    .in('driver_id', driverIds)
    .gte('created_at', todayStart.toISOString());

  // Count orders per driver
  const orderCountMap = new Map<string, number>();
  for (const o of orders ?? []) {
    const dId = o.driver_id as string;
    orderCountMap.set(dId, (orderCountMap.get(dId) ?? 0) + 1);
  }

  // Get shift starts for today
  const { data: shifts } = await ssb
    .from('driver_shifts')
    .select('driver_id, started_at')
    .eq('location_id', locationId)
    .in('driver_id', driverIds)
    .gte('started_at', todayStart.toISOString());

  const shiftMap = new Map<string, string>();
  for (const s of shifts ?? []) {
    const dId = s.driver_id as string;
    // Keep earliest shift start per driver
    if (!shiftMap.has(dId) || new Date(s.started_at as string) < new Date(shiftMap.get(dId)!)) {
      shiftMap.set(dId, s.started_at as string);
    }
  }

  // Calculate efficiency per driver
  const rawDrivers = onlineDrivers.map((d: { id: string; name: string }) => {
    const ordersToday = orderCountMap.get(d.id) ?? 0;
    const shiftStartStr = shiftMap.get(d.id);
    const hoursActive = shiftStartStr
      ? Math.max(0.5, (now.getTime() - new Date(shiftStartStr).getTime()) / 3_600_000)
      : 0.5;
    const ordersPerHour = Math.round((ordersToday / hoursActive) * 10) / 10;
    return { id: d.id, name: d.name as string, ordersToday, hoursActive: Math.round(hoursActive * 10) / 10, ordersPerHour };
  });

  const avgOrdersPerHour =
    rawDrivers.length > 0
      ? Math.round((rawDrivers.reduce((sum, d) => sum + d.ordersPerHour, 0) / rawDrivers.length) * 10) / 10
      : 0;

  const drivers: DriverEff[] = rawDrivers.map((d) => ({
    ...d,
    status:
      d.ordersPerHour >= avgOrdersPerHour * 1.2
        ? 'hoch'
        : d.ordersPerHour >= avgOrdersPerHour * 0.8
        ? 'normal'
        : 'niedrig',
  }));

  return NextResponse.json({ ok: true, drivers, avgOrdersPerHour, generatedAt: now.toISOString() });
}
