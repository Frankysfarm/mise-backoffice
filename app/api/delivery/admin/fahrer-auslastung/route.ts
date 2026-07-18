/**
 * GET /api/delivery/admin/fahrer-auslastung?location_id=...
 *
 * Auslastungs-Rate je Fahrer heute (aktive Fahrzeit / Schichtdauer in %).
 * Alert wenn <40% oder >90%. Ampel grün(60–85%)/gelb(40–59% od. 86–90%)/rot(<40% od. >90%).
 * Trend vs. gleicher Wochentag letzte Woche. Multi-Tenant; Supabase+Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface FahrerAuslastung {
  id: string;
  name: string;
  rate_pct: number;
  rate_pct_vw: number;
  fahrzeit_min: number;
  schichtdauer_min: number;
  touren: number;
  trend: 'up' | 'down' | 'neutral';
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: boolean;
  alert_typ: 'under' | 'over' | null;
}

export interface AuslastungResponse {
  fahrer: FahrerAuslastung[];
  team_avg_pct: number;
  team_avg_pct_vw: number;
  alert_count: number;
  generiert_am: string;
  mock?: boolean;
}

function classifyAmpel(rate: number): 'gruen' | 'gelb' | 'rot' {
  if (rate >= 60 && rate <= 85) return 'gruen';
  if ((rate >= 40 && rate < 60) || (rate > 85 && rate <= 90)) return 'gelb';
  return 'rot';
}

function classifyAlert(rate: number): { alert: boolean; alert_typ: 'under' | 'over' | null } {
  if (rate < 40) return { alert: true, alert_typ: 'under' };
  if (rate > 90) return { alert: true, alert_typ: 'over' };
  return { alert: false, alert_typ: null };
}

function mockData(): AuslastungResponse {
  const fahrer: FahrerAuslastung[] = [
    { id: 'd1', name: 'Anna K.', rate_pct: 78, rate_pct_vw: 72, fahrzeit_min: 374, schichtdauer_min: 480, touren: 12, trend: 'up', ampel: 'gruen', alert: false, alert_typ: null },
    { id: 'd2', name: 'Ben T.', rate_pct: 92, rate_pct_vw: 85, fahrzeit_min: 442, schichtdauer_min: 480, touren: 15, trend: 'down', ampel: 'rot', alert: true, alert_typ: 'over' },
    { id: 'd3', name: 'Chris M.', rate_pct: 35, rate_pct_vw: 42, fahrzeit_min: 168, schichtdauer_min: 480, touren: 6, trend: 'down', ampel: 'rot', alert: true, alert_typ: 'under' },
    { id: 'd4', name: 'Diana P.', rate_pct: 65, rate_pct_vw: 68, fahrzeit_min: 312, schichtdauer_min: 480, touren: 11, trend: 'neutral', ampel: 'gruen', alert: false, alert_typ: null },
    { id: 'd5', name: 'Enzo R.', rate_pct: 52, rate_pct_vw: 48, fahrzeit_min: 250, schichtdauer_min: 480, touren: 9, trend: 'up', ampel: 'gelb', alert: false, alert_typ: null },
  ];
  const sorted = [...fahrer].sort((a, b) => b.rate_pct - a.rate_pct);
  const team_avg_pct = Math.round(sorted.reduce((s, d) => s + d.rate_pct, 0) / sorted.length);
  const team_avg_pct_vw = Math.round(sorted.reduce((s, d) => s + d.rate_pct_vw, 0) / sorted.length);
  return {
    fahrer: sorted,
    team_avg_pct,
    team_avg_pct_vw,
    alert_count: sorted.filter(d => d.alert).length,
    generiert_am: new Date().toISOString(),
    mock: true,
  };
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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let locationId = searchParams.get('location_id');
    const driverId = searchParams.get('driver_id');

    try {
      const sb = await createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (user && !locationId) locationId = await resolveLocationId(user.id);
    } catch {
      // unauthenticated — fall through to mock
    }

    if (!locationId) {
      const mock = mockData();
      if (driverId) {
        const f = mock.fahrer.find(d => d.id === driverId) ?? mock.fahrer[0];
        return NextResponse.json({ ok: true, fahrer_single: f, team_avg_pct: mock.team_avg_pct, generiert_am: mock.generiert_am, mock: true });
      }
      return NextResponse.json({ ok: true, ...mock });
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

    const driverIds = (driversRaw as { id: string }[]).map(d => d.id);

    const { data: shiftsToday } = await ssb
      .from('driver_shifts')
      .select('driver_id, started_at, ended_at')
      .eq('location_id', locationId)
      .in('driver_id', driverIds)
      .gte('started_at', todayStart.toISOString());

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

    function buildFahrzeitMap(orders: Array<{ driver_id: string; confirmed_at: string; actual_delivery_at: string }>) {
      const map = new Map<string, { sum: number; count: number }>();
      for (const o of orders) {
        const diffMs = new Date(o.actual_delivery_at).getTime() - new Date(o.confirmed_at).getTime();
        const diffMin = diffMs / 60_000;
        if (diffMin <= 0 || diffMin > 240) continue;
        if (!map.has(o.driver_id)) map.set(o.driver_id, { sum: 0, count: 0 });
        const e = map.get(o.driver_id)!;
        e.sum += diffMin;
        e.count++;
      }
      return map;
    }

    function buildSchichtMap(shifts: Array<{ driver_id: string; started_at: string; ended_at: string | null }>) {
      const map = new Map<string, number>();
      for (const s of shifts) {
        const end = s.ended_at ? new Date(s.ended_at) : now;
        const diffMin = (end.getTime() - new Date(s.started_at).getTime()) / 60_000;
        if (diffMin <= 0) continue;
        map.set(s.driver_id, (map.get(s.driver_id) ?? 0) + diffMin);
      }
      return map;
    }

    const fahrzeitToday = buildFahrzeitMap(
      (ordersToday ?? []) as Array<{ driver_id: string; confirmed_at: string; actual_delivery_at: string }>
    );
    const fahrzeitVW = buildFahrzeitMap(
      (ordersVW ?? []) as Array<{ driver_id: string; confirmed_at: string; actual_delivery_at: string }>
    );
    const schichtMap = buildSchichtMap(
      (shiftsToday ?? []) as Array<{ driver_id: string; started_at: string; ended_at: string | null }>
    );

    const DEFAULT_SCHICHT = 480;

    const fahrer: FahrerAuslastung[] = (driversRaw as { id: string; name: string }[]).map(d => {
      const t = fahrzeitToday.get(d.id) ?? { sum: 0, count: 0 };
      const v = fahrzeitVW.get(d.id) ?? { sum: 0, count: 0 };
      const schicht = schichtMap.get(d.id) ?? DEFAULT_SCHICHT;

      const fahrzeit_min = Math.round(t.sum);
      const rate_pct = schicht > 0 ? Math.round((fahrzeit_min / schicht) * 100) : 0;
      const vw_fahrzeit = Math.round(v.sum);
      const rate_pct_vw = schicht > 0 ? Math.round((vw_fahrzeit / schicht) * 100) : 0;

      const trend: 'up' | 'down' | 'neutral' =
        rate_pct > rate_pct_vw + 3 ? 'up' : rate_pct < rate_pct_vw - 3 ? 'down' : 'neutral';
      const ampel = classifyAmpel(rate_pct);
      const { alert, alert_typ } = classifyAlert(rate_pct);

      return {
        id: d.id,
        name: d.name as string,
        rate_pct,
        rate_pct_vw,
        fahrzeit_min,
        schichtdauer_min: Math.round(schicht),
        touren: t.count,
        trend,
        ampel,
        alert,
        alert_typ,
      };
    });

    const active = fahrer.filter(f => f.touren > 0).sort((a, b) => b.rate_pct - a.rate_pct);
    const all = active.length > 0 ? active : fahrer;
    const team_avg_pct = all.length > 0 ? Math.round(all.reduce((s, d) => s + d.rate_pct, 0) / all.length) : 0;
    const team_avg_pct_vw = all.length > 0 ? Math.round(all.reduce((s, d) => s + d.rate_pct_vw, 0) / all.length) : 0;

    if (driverId) {
      const f = fahrer.find(d => d.id === driverId) ?? fahrer[0];
      return NextResponse.json({ ok: true, fahrer_single: f ?? null, team_avg_pct, generiert_am: now.toISOString() });
    }

    return NextResponse.json({
      ok: true,
      fahrer: all,
      team_avg_pct,
      team_avg_pct_vw,
      alert_count: all.filter(d => d.alert).length,
      generiert_am: now.toISOString(),
    });
  } catch (err) {
    console.error('[fahrer-auslastung]', err);
    return NextResponse.json({ ok: true, ...mockData() });
  }
}
