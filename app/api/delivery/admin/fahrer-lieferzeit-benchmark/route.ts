/**
 * GET /api/delivery/admin/fahrer-lieferzeit-benchmark?location_id=...
 *
 * Ø Lieferzeit je Fahrer heute (confirmed_at → actual_delivery_at in Minuten).
 * Vergleich mit Store-Ø und Benchmark-Ziel (30 Min). Alert wenn >45 Min.
 * Trend vs. gleicher Wochentag letzte Woche. Multi-Tenant; Supabase+Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface FahrerLieferzeit {
  id: string;
  name: string;
  avg_min: number;
  avg_min_vw: number;
  min_min: number;
  touren: number;
  trend: 'up' | 'down' | 'neutral';
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: boolean;
}

export interface LieferzeitBenchmarkResponse {
  fahrer: FahrerLieferzeit[];
  team_avg_min: number;
  team_avg_min_vw: number;
  benchmark_min: number;
  alert_count: number;
  generiert_am: string;
  mock?: boolean;
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

function classifyAmpel(avg: number): 'gruen' | 'gelb' | 'rot' {
  if (avg < 30) return 'gruen';
  if (avg <= 45) return 'gelb';
  return 'rot';
}

function mockData(): LieferzeitBenchmarkResponse {
  const fahrer: FahrerLieferzeit[] = [
    { id: 'd1', name: 'Anna K.', avg_min: 24.5, avg_min_vw: 26.2, min_min: 18, touren: 12, trend: 'up', ampel: 'gruen', alert: false },
    { id: 'd2', name: 'Ben T.', avg_min: 31.8, avg_min_vw: 29.4, min_min: 22, touren: 15, trend: 'down', ampel: 'gelb', alert: false },
    { id: 'd3', name: 'Chris M.', avg_min: 48.2, avg_min_vw: 44.7, min_min: 35, touren: 10, trend: 'down', ampel: 'rot', alert: true },
    { id: 'd4', name: 'Diana P.', avg_min: 27.3, avg_min_vw: 28.1, min_min: 19, touren: 14, trend: 'up', ampel: 'gruen', alert: false },
  ];
  const sorted = [...fahrer].sort((a, b) => a.avg_min - b.avg_min);
  const team_avg_min = Math.round((sorted.reduce((s, d) => s + d.avg_min, 0) / sorted.length) * 10) / 10;
  const team_avg_min_vw = Math.round((sorted.reduce((s, d) => s + d.avg_min_vw, 0) / sorted.length) * 10) / 10;
  return {
    fahrer: sorted,
    team_avg_min,
    team_avg_min_vw,
    benchmark_min: 30,
    alert_count: sorted.filter(d => d.alert).length,
    generiert_am: new Date().toISOString(),
    mock: true,
  };
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
      return NextResponse.json({ ok: true, ...mockData() });
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
      return NextResponse.json({ ok: true, ...mockData() });
    }

    const driverIds = (driversRaw as { id: string }[]).map((d) => d.id);

    const { data: ordersToday } = await ssb
      .from('customer_orders')
      .select('driver_id, confirmed_at, actual_delivery_at')
      .eq('location_id', locationId)
      .in('driver_id', driverIds)
      .not('confirmed_at', 'is', null)
      .not('actual_delivery_at', 'is', null)
      .gte('confirmed_at', todayStart.toISOString());

    const { data: ordersVW } = await ssb
      .from('customer_orders')
      .select('driver_id, confirmed_at, actual_delivery_at')
      .eq('location_id', locationId)
      .in('driver_id', driverIds)
      .not('confirmed_at', 'is', null)
      .not('actual_delivery_at', 'is', null)
      .gte('confirmed_at', vwStart.toISOString())
      .lt('confirmed_at', vwEnd.toISOString());

    function buildMap(orders: Array<{ driver_id: string; confirmed_at: string; actual_delivery_at: string }>) {
      const map = new Map<string, { sum: number; count: number; min: number }>();
      for (const o of orders) {
        const diffMs = new Date(o.actual_delivery_at).getTime() - new Date(o.confirmed_at).getTime();
        const diffMin = diffMs / 60_000;
        if (diffMin <= 0 || diffMin > 240) continue; // sanity filter
        if (!map.has(o.driver_id)) map.set(o.driver_id, { sum: 0, count: 0, min: Infinity });
        const e = map.get(o.driver_id)!;
        e.sum += diffMin;
        e.count++;
        if (diffMin < e.min) e.min = diffMin;
      }
      return map;
    }

    const todayMap = buildMap(
      (ordersToday ?? []) as Array<{ driver_id: string; confirmed_at: string; actual_delivery_at: string }>
    );
    const vwMap = buildMap(
      (ordersVW ?? []) as Array<{ driver_id: string; confirmed_at: string; actual_delivery_at: string }>
    );

    const fahrer: FahrerLieferzeit[] = (driversRaw as { id: string; name: string }[]).map((d) => {
      const t = todayMap.get(d.id) ?? { sum: 0, count: 0, min: 0 };
      const v = vwMap.get(d.id) ?? { sum: 0, count: 0, min: 0 };

      const avg = t.count > 0 ? Math.round((t.sum / t.count) * 10) / 10 : 0;
      const avgVW = v.count > 0 ? Math.round((v.sum / v.count) * 10) / 10 : 0;
      const minMin = t.min === Infinity ? 0 : Math.round(t.min * 10) / 10;

      const trend: 'up' | 'down' | 'neutral' =
        avg < avgVW - 1 ? 'up' : avg > avgVW + 1 ? 'down' : 'neutral';
      const ampel = classifyAmpel(avg);

      return {
        id: d.id,
        name: d.name as string,
        avg_min: avg,
        avg_min_vw: avgVW,
        min_min: minMin,
        touren: t.count,
        trend,
        ampel,
        alert: avg > 45,
      };
    });

    const sorted = fahrer.filter(f => f.touren > 0).sort((a, b) => a.avg_min - b.avg_min);
    const allForTeam = sorted.length > 0 ? sorted : fahrer;
    const team_avg_min =
      allForTeam.length > 0
        ? Math.round((allForTeam.reduce((s, d) => s + d.avg_min, 0) / allForTeam.length) * 10) / 10
        : 0;
    const team_avg_min_vw =
      allForTeam.length > 0
        ? Math.round((allForTeam.reduce((s, d) => s + d.avg_min_vw, 0) / allForTeam.length) * 10) / 10
        : 0;
    const alert_count = sorted.filter(d => d.alert).length;

    return NextResponse.json({
      ok: true,
      fahrer: sorted.length > 0 ? sorted : fahrer,
      team_avg_min,
      team_avg_min_vw,
      benchmark_min: 30,
      alert_count,
      generiert_am: now.toISOString(),
    });
  } catch (err) {
    console.error('[fahrer-lieferzeit-benchmark]', err);
    return NextResponse.json({ ok: true, ...mockData() });
  }
}
