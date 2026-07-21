import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';
type Trend = 'steigend' | 'fallend' | 'stabil';

function calcAmpel(pct: number): Ampel {
  if (pct >= 95) return 'gruen';
  if (pct >= 85) return 'gelb';
  return 'rot';
}

function calcTrend(curr: number, prev: number): { trend: Trend; delta: number } {
  const delta = Math.round(curr - prev);
  if (delta > 3) return { trend: 'steigend', delta };
  if (delta < -3) return { trend: 'fallend', delta };
  return { trend: 'stabil', delta };
}

export interface FahrerZuverlaessigkeitEntry {
  fahrer_id: string;
  fahrer_name: string;
  abschluss_pct: number;
  abschluss_pct_gestern: number;
  lieferungen_heute: number;
  abgeschlossen: number;
  trend: Trend;
  trend_delta: number;
  ampel: Ampel;
  alert_niedrig: boolean;
}

export interface FahrerZuverlaessigkeitResponse {
  fahrer: FahrerZuverlaessigkeitEntry[];
  team_durchschnitt: number;
  alert_count: number;
  generiert_am: string;
}

function buildMock(driverId?: string): FahrerZuverlaessigkeitResponse {
  const drivers = [
    { id: 'd1', name: 'Max M.',   pct: 98, pct_g: 96 },
    { id: 'd2', name: 'Lisa F.',  pct: 95, pct_g: 94 },
    { id: 'd3', name: 'Sara K.',  pct: 88, pct_g: 91 },
    { id: 'd4', name: 'Tim B.',   pct: 80, pct_g: 85 },
  ];

  const allFahrer: FahrerZuverlaessigkeitEntry[] = drivers.map(d => {
    const { trend, delta } = calcTrend(d.pct, d.pct_g);
    const lieferungen = 20;
    return {
      fahrer_id: d.id,
      fahrer_name: d.name,
      abschluss_pct: d.pct,
      abschluss_pct_gestern: d.pct_g,
      lieferungen_heute: lieferungen,
      abgeschlossen: Math.round(lieferungen * d.pct / 100),
      trend,
      trend_delta: delta,
      ampel: calcAmpel(d.pct),
      alert_niedrig: d.pct < 85,
    };
  });

  const fahrer = driverId ? allFahrer.filter(f => f.fahrer_id === driverId) : allFahrer;
  const team = allFahrer.reduce((s, f) => s + f.abschluss_pct, 0) / allFahrer.length;

  return {
    fahrer,
    team_durchschnitt: Math.round(team * 10) / 10,
    alert_count: allFahrer.filter(f => f.alert_niedrig).length,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const driverId = searchParams.get('driver_id') ?? undefined;

  if (!locationId) {
    return NextResponse.json(buildMock(driverId));
  }

  try {
    const supabase = createServiceClient();
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    const { data: stopsToday } = await supabase
      .from('batch_stops')
      .select('driver_id, status')
      .eq('location_id', locationId)
      .gte('created_at', `${today}T00:00:00Z`)
      .lt('created_at', `${today}T23:59:59Z`);

    const { data: stopsYesterday } = await supabase
      .from('batch_stops')
      .select('driver_id, status')
      .eq('location_id', locationId)
      .gte('created_at', `${yesterday}T00:00:00Z`)
      .lt('created_at', `${yesterday}T23:59:59Z`);

    const { data: driverData } = await supabase
      .from('drivers')
      .select('id, full_name')
      .eq('location_id', locationId);

    const driverNames: Record<string, string> = {};
    (driverData ?? []).forEach(d => { driverNames[d.id] = d.full_name ?? d.id; });

    function groupByDriver(stops: { driver_id: string; status: string }[]) {
      const map: Record<string, { total: number; abgeschlossen: number }> = {};
      for (const s of stops) {
        if (!s.driver_id) continue;
        if (!map[s.driver_id]) map[s.driver_id] = { total: 0, abgeschlossen: 0 };
        map[s.driver_id].total++;
        if (s.status === 'completed' || s.status === 'delivered') {
          map[s.driver_id].abgeschlossen++;
        }
      }
      return map;
    }

    const todayMap = groupByDriver(
      (stopsToday ?? []) as { driver_id: string; status: string }[]
    );
    const yesterdayMap = groupByDriver(
      (stopsYesterday ?? []) as { driver_id: string; status: string }[]
    );

    if (Object.keys(todayMap).length === 0) {
      return NextResponse.json(buildMock(driverId));
    }

    const allFahrer: FahrerZuverlaessigkeitEntry[] = Object.entries(todayMap).map(([id, v]) => {
      const pct = v.total > 0 ? Math.round((v.abgeschlossen / v.total) * 1000) / 10 : 0;
      const yv = yesterdayMap[id];
      const pctG = yv && yv.total > 0 ? Math.round((yv.abgeschlossen / yv.total) * 1000) / 10 : pct;
      const { trend, delta } = calcTrend(pct, pctG);
      return {
        fahrer_id: id,
        fahrer_name: driverNames[id] ?? id,
        abschluss_pct: pct,
        abschluss_pct_gestern: pctG,
        lieferungen_heute: v.total,
        abgeschlossen: v.abgeschlossen,
        trend,
        trend_delta: delta,
        ampel: calcAmpel(pct),
        alert_niedrig: pct < 85,
      };
    });

    const filtered = driverId ? allFahrer.filter(f => f.fahrer_id === driverId) : allFahrer;
    const team = allFahrer.reduce((s, f) => s + f.abschluss_pct, 0) / (allFahrer.length || 1);

    return NextResponse.json({
      fahrer: filtered,
      team_durchschnitt: Math.round(team * 10) / 10,
      alert_count: allFahrer.filter(f => f.alert_niedrig).length,
      generiert_am: new Date().toISOString(),
    } satisfies FahrerZuverlaessigkeitResponse);
  } catch {
    return NextResponse.json(buildMock(driverId));
  }
}
