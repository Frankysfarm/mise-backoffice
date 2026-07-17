/**
 * GET /api/delivery/admin/fahrer-storno-analyse?location_id=...
 *
 * Stornoquote je Fahrer heute + Trend vs. 7-Tage-Ø.
 * Alert wenn Stornoquote >10%.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface DriverStorno {
  id: string;
  name: string;
  totalOrders: number;
  cancelledOrders: number;
  cancelRate: number; // 0–100 %
  cancelRate7d: number; // 7-Tage-Ø
  trend: 'up' | 'down' | 'neutral';
  alert: boolean;
}

async function resolveLocationId(userId: string): Promise<string | null> {
  const sb = await createClient();
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('user_id', userId)
    .single();
  return (emp?.location_id as string) ?? null;
}

function mockData(): { drivers: DriverStorno[]; teamAvgCancelRate: number; teamAvg7d: number } {
  const drivers: DriverStorno[] = [
    { id: 'd1', name: 'Anna K.', totalOrders: 18, cancelledOrders: 0, cancelRate: 0, cancelRate7d: 1.5, trend: 'down', alert: false },
    { id: 'd2', name: 'Ben T.', totalOrders: 22, cancelledOrders: 1, cancelRate: 4.5, cancelRate7d: 3.8, trend: 'up', alert: false },
    { id: 'd3', name: 'Chris M.', totalOrders: 15, cancelledOrders: 2, cancelRate: 13.3, cancelRate7d: 8.5, trend: 'up', alert: true },
    { id: 'd4', name: 'Diana P.', totalOrders: 20, cancelledOrders: 0, cancelRate: 0, cancelRate7d: 2.1, trend: 'down', alert: false },
  ];
  const teamAvgCancelRate = Math.round((drivers.reduce((s, d) => s + d.cancelRate, 0) / drivers.length) * 10) / 10;
  const teamAvg7d = Math.round((drivers.reduce((s, d) => s + d.cancelRate7d, 0) / drivers.length) * 10) / 10;
  return { drivers, teamAvgCancelRate, teamAvg7d };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let locationId = searchParams.get('location_id');

    try {
      const sb = await createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (user && !locationId) locationId = await resolveLocationId(user.id);
    } catch {
      // unauthenticated — fall through to mock
    }

    if (!locationId) {
      const mock = mockData();
      return NextResponse.json({ ok: true, ...mock, generatedAt: new Date().toISOString(), mock: true });
    }

    const ssb = await createServiceClient();
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3_600_000);

    const { data: driversRaw } = await ssb
      .from('drivers')
      .select('id, name')
      .eq('location_id', locationId);

    if (!driversRaw || driversRaw.length === 0) {
      const mock = mockData();
      return NextResponse.json({ ok: true, ...mock, generatedAt: now.toISOString(), mock: true });
    }

    const driverIds = driversRaw.map((d: { id: string }) => d.id);

    const { data: ordersToday } = await ssb
      .from('customer_orders')
      .select('driver_id, status')
      .eq('location_id', locationId)
      .in('driver_id', driverIds)
      .gte('created_at', todayStart.toISOString());

    const { data: orders7d } = await ssb
      .from('customer_orders')
      .select('driver_id, status')
      .eq('location_id', locationId)
      .in('driver_id', driverIds)
      .gte('created_at', sevenDaysAgo.toISOString())
      .lt('created_at', todayStart.toISOString());

    const todayMap = new Map<string, { total: number; cancelled: number }>();
    const weekMap = new Map<string, { total: number; cancelled: number }>();

    for (const o of ordersToday ?? []) {
      const dId = o.driver_id as string;
      const entry = todayMap.get(dId) ?? { total: 0, cancelled: 0 };
      entry.total++;
      if (o.status === 'storniert') entry.cancelled++;
      todayMap.set(dId, entry);
    }
    for (const o of orders7d ?? []) {
      const dId = o.driver_id as string;
      const entry = weekMap.get(dId) ?? { total: 0, cancelled: 0 };
      entry.total++;
      if (o.status === 'storniert') entry.cancelled++;
      weekMap.set(dId, entry);
    }

    const drivers: DriverStorno[] = (driversRaw as { id: string; name: string }[]).map((d) => {
      const today = todayMap.get(d.id) ?? { total: 0, cancelled: 0 };
      const week = weekMap.get(d.id) ?? { total: 0, cancelled: 0 };
      const cancelRate = today.total > 0 ? Math.round((today.cancelled / today.total) * 1000) / 10 : 0;
      const cancelRate7d = week.total > 0 ? Math.round((week.cancelled / week.total) * 1000) / 10 : 0;
      const trend: 'up' | 'down' | 'neutral' =
        cancelRate > cancelRate7d + 2 ? 'up' : cancelRate < cancelRate7d - 2 ? 'down' : 'neutral';
      return {
        id: d.id,
        name: d.name as string,
        totalOrders: today.total,
        cancelledOrders: today.cancelled,
        cancelRate,
        cancelRate7d,
        trend,
        alert: cancelRate >= 10,
      };
    });

    const teamAvgCancelRate =
      drivers.length > 0
        ? Math.round((drivers.reduce((s, d) => s + d.cancelRate, 0) / drivers.length) * 10) / 10
        : 0;
    const teamAvg7d =
      drivers.length > 0
        ? Math.round((drivers.reduce((s, d) => s + d.cancelRate7d, 0) / drivers.length) * 10) / 10
        : 0;

    return NextResponse.json({ ok: true, drivers, teamAvgCancelRate, teamAvg7d, generatedAt: now.toISOString() });
  } catch (err) {
    console.error('[fahrer-storno-analyse]', err);
    const mock = mockData();
    return NextResponse.json({ ok: true, ...mock, generatedAt: new Date().toISOString(), mock: true });
  }
}
