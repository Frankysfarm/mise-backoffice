/**
 * GET /api/delivery/admin/fahrer-trinkgeld?location_id=...
 *
 * Trinkgeld-Übersicht je Fahrer heute: Gesamt-Trinkgeld, Ø Trinkgeld/Tour,
 * Trend vs. gleicher Wochentag letzte Woche. Alert wenn Ø < 0,50 €.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface FahrerTrinkgeld {
  id: string;
  name: string;
  trinkgeld_gesamt: number;
  trinkgeld_avg: number;
  trinkgeld_avg_vw: number;
  touren: number;
  trend: 'up' | 'down' | 'neutral';
  ampel: 'gruen' | 'gelb' | 'rot';
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

function mockData(): { fahrer: FahrerTrinkgeld[]; team_avg: number; team_avg_vw: number; alert_count: number } {
  const fahrer: FahrerTrinkgeld[] = [
    { id: 'd1', name: 'Anna K.', trinkgeld_gesamt: 18.50, trinkgeld_avg: 1.03, trinkgeld_avg_vw: 0.85, touren: 18, trend: 'up', ampel: 'gruen', alert: false },
    { id: 'd2', name: 'Ben T.', trinkgeld_gesamt: 9.20, trinkgeld_avg: 0.42, trinkgeld_avg_vw: 0.55, touren: 22, trend: 'down', ampel: 'rot', alert: true },
    { id: 'd3', name: 'Chris M.', trinkgeld_gesamt: 7.50, trinkgeld_avg: 0.50, trinkgeld_avg_vw: 0.48, touren: 15, trend: 'neutral', ampel: 'gelb', alert: false },
    { id: 'd4', name: 'Diana P.', trinkgeld_gesamt: 16.00, trinkgeld_avg: 0.80, trinkgeld_avg_vw: 0.72, touren: 20, trend: 'up', ampel: 'gruen', alert: false },
  ];
  const sorted = [...fahrer].sort((a, b) => b.trinkgeld_avg - a.trinkgeld_avg);
  const team_avg = sorted.reduce((s, d) => s + d.trinkgeld_avg, 0) / sorted.length;
  const team_avg_vw = sorted.reduce((s, d) => s + d.trinkgeld_avg_vw, 0) / sorted.length;
  return { fahrer: sorted, team_avg: Math.round(team_avg * 100) / 100, team_avg_vw: Math.round(team_avg_vw * 100) / 100, alert_count: sorted.filter(d => d.alert).length };
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
      return NextResponse.json({ ok: true, ...mock, generiert_am: new Date().toISOString(), mock: true });
    }

    const ssb = await createServiceClient();
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const vwStart = new Date(todayStart.getTime() - 7 * 24 * 3_600_000);
    const vwEnd = new Date(todayStart.getTime() - 6 * 24 * 3_600_000);

    const { data: driversRaw } = await ssb
      .from('drivers')
      .select('id, name')
      .eq('location_id', locationId);

    if (!driversRaw || driversRaw.length === 0) {
      const mock = mockData();
      return NextResponse.json({ ok: true, ...mock, generiert_am: now.toISOString(), mock: true });
    }

    const driverIds = driversRaw.map((d: { id: string }) => d.id);

    const { data: ordersToday } = await ssb
      .from('customer_orders')
      .select('driver_id, tip_amount')
      .eq('location_id', locationId)
      .in('driver_id', driverIds)
      .gte('created_at', todayStart.toISOString());

    const { data: ordersVW } = await ssb
      .from('customer_orders')
      .select('driver_id, tip_amount')
      .eq('location_id', locationId)
      .in('driver_id', driverIds)
      .gte('created_at', vwStart.toISOString())
      .lt('created_at', vwEnd.toISOString());

    function buildMap(orders: Array<{ driver_id: string; tip_amount: number | null }>) {
      const map = new Map<string, { total: number; sum: number }>();
      for (const o of orders) {
        if (!map.has(o.driver_id)) map.set(o.driver_id, { total: 0, sum: 0 });
        const e = map.get(o.driver_id)!;
        e.total++;
        e.sum += Number(o.tip_amount ?? 0);
      }
      return map;
    }

    const todayMap = buildMap((ordersToday ?? []) as Array<{ driver_id: string; tip_amount: number | null }>);
    const vwMap = buildMap((ordersVW ?? []) as Array<{ driver_id: string; tip_amount: number | null }>);

    const fahrer: FahrerTrinkgeld[] = (driversRaw as { id: string; name: string }[]).map((d) => {
      const t = todayMap.get(d.id) ?? { total: 0, sum: 0 };
      const v = vwMap.get(d.id) ?? { total: 0, sum: 0 };

      const avg = t.total > 0 ? Math.round((t.sum / t.total) * 100) / 100 : 0;
      const avgVW = v.total > 0 ? Math.round((v.sum / v.total) * 100) / 100 : 0;

      const trend: 'up' | 'down' | 'neutral' = avg > avgVW + 0.05 ? 'up' : avg < avgVW - 0.05 ? 'down' : 'neutral';
      const ampel: 'gruen' | 'gelb' | 'rot' = avg >= 0.75 ? 'gruen' : avg >= 0.50 ? 'gelb' : 'rot';

      return {
        id: d.id,
        name: d.name as string,
        trinkgeld_gesamt: Math.round(t.sum * 100) / 100,
        trinkgeld_avg: avg,
        trinkgeld_avg_vw: avgVW,
        touren: t.total,
        trend,
        ampel,
        alert: avg < 0.50,
      };
    });

    const sorted = fahrer.sort((a, b) => b.trinkgeld_avg - a.trinkgeld_avg);
    const team_avg = sorted.length > 0 ? Math.round((sorted.reduce((s, d) => s + d.trinkgeld_avg, 0) / sorted.length) * 100) / 100 : 0;
    const team_avg_vw = sorted.length > 0 ? Math.round((sorted.reduce((s, d) => s + d.trinkgeld_avg_vw, 0) / sorted.length) * 100) / 100 : 0;
    const alert_count = sorted.filter(d => d.alert).length;

    return NextResponse.json({ ok: true, fahrer: sorted, team_avg, team_avg_vw, alert_count, generiert_am: now.toISOString() });
  } catch (err) {
    console.error('[fahrer-trinkgeld]', err);
    const mock = mockData();
    return NextResponse.json({ ok: true, ...mock, generiert_am: new Date().toISOString(), mock: true });
  }
}
