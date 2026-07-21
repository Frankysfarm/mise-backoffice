import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';
type Trend = 'steigend' | 'fallend' | 'stabil';

function calcAmpel(pct: number): Ampel {
  if (pct >= 90) return 'gruen';
  if (pct >= 70) return 'gelb';
  return 'rot';
}

function calcTrend(curr: number, prev: number): { trend: Trend; delta: number } {
  const delta = Math.round(curr - prev);
  if (delta > 3) return { trend: 'steigend', delta };
  if (delta < -3) return { trend: 'fallend', delta };
  return { trend: 'stabil', delta };
}

export interface FahrerPuenktlichkeitV2Entry {
  fahrer_id: string;
  fahrer_name: string;
  puenktlichkeit_pct: number;
  puenktlichkeit_pct_gestern: number;
  lieferungen_heute: number;
  rechtzeitig: number;
  trend: Trend;
  trend_delta: number;
  ampel: Ampel;
  alert_unpuenktlich: boolean;
}

export interface FahrerPuenktlichkeitV2Response {
  fahrer: FahrerPuenktlichkeitV2Entry[];
  team_durchschnitt: number;
  alert_count: number;
  generiert_am: string;
}

function buildMock(driverId?: string): FahrerPuenktlichkeitV2Response {
  const drivers = [
    { id: 'd1', name: 'Max M.',   pct: 96, pct_g: 93 },
    { id: 'd2', name: 'Lisa F.',  pct: 91, pct_g: 89 },
    { id: 'd3', name: 'Sara K.',  pct: 78, pct_g: 82 },
    { id: 'd4', name: 'Tim B.',   pct: 62, pct_g: 68 },
  ];

  const allFahrer: FahrerPuenktlichkeitV2Entry[] = drivers.map(d => {
    const { trend, delta } = calcTrend(d.pct, d.pct_g);
    const lieferungen = 20;
    return {
      fahrer_id: d.id,
      fahrer_name: d.name,
      puenktlichkeit_pct: d.pct,
      puenktlichkeit_pct_gestern: d.pct_g,
      lieferungen_heute: lieferungen,
      rechtzeitig: Math.round(lieferungen * d.pct / 100),
      trend,
      trend_delta: delta,
      ampel: calcAmpel(d.pct),
      alert_unpuenktlich: d.pct < 70,
    };
  });

  const fahrer = driverId ? allFahrer.filter(f => f.fahrer_id === driverId) : allFahrer;
  const team = allFahrer.reduce((s, f) => s + f.puenktlichkeit_pct, 0) / allFahrer.length;

  return {
    fahrer,
    team_durchschnitt: Math.round(team * 10) / 10,
    alert_count: allFahrer.filter(f => f.alert_unpuenktlich).length,
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
      .select('driver_id, actual_arrival_at, eta_at')
      .eq('location_id', locationId)
      .gte('created_at', `${today}T00:00:00Z`)
      .lt('created_at', `${today}T23:59:59Z`)
      .not('actual_arrival_at', 'is', null)
      .not('eta_at', 'is', null);

    const { data: stopsYesterday } = await supabase
      .from('batch_stops')
      .select('driver_id, actual_arrival_at, eta_at')
      .eq('location_id', locationId)
      .gte('created_at', `${yesterday}T00:00:00Z`)
      .lt('created_at', `${yesterday}T23:59:59Z`)
      .not('actual_arrival_at', 'is', null)
      .not('eta_at', 'is', null);

    const { data: driverData } = await supabase
      .from('drivers')
      .select('id, full_name')
      .eq('location_id', locationId);

    const driverNames: Record<string, string> = {};
    (driverData ?? []).forEach(d => { driverNames[d.id] = d.full_name ?? d.id; });

    function groupByDriver(stops: { driver_id: string; actual_arrival_at: string; eta_at: string }[]) {
      const map: Record<string, { total: number; rechtzeitig: number }> = {};
      for (const s of stops) {
        if (!s.driver_id) continue;
        if (!map[s.driver_id]) map[s.driver_id] = { total: 0, rechtzeitig: 0 };
        map[s.driver_id].total++;
        const diff = Math.abs(
          (new Date(s.actual_arrival_at).getTime() - new Date(s.eta_at).getTime()) / 60000
        );
        if (diff <= 5) map[s.driver_id].rechtzeitig++;
      }
      return map;
    }

    const todayMap = groupByDriver(
      (stopsToday ?? []) as { driver_id: string; actual_arrival_at: string; eta_at: string }[]
    );
    const yesterdayMap = groupByDriver(
      (stopsYesterday ?? []) as { driver_id: string; actual_arrival_at: string; eta_at: string }[]
    );

    if (Object.keys(todayMap).length === 0) {
      return NextResponse.json(buildMock(driverId));
    }

    const allFahrer: FahrerPuenktlichkeitV2Entry[] = Object.entries(todayMap).map(([id, v]) => {
      const pct = v.total > 0 ? Math.round((v.rechtzeitig / v.total) * 1000) / 10 : 0;
      const yv = yesterdayMap[id];
      const pctG = yv && yv.total > 0 ? Math.round((yv.rechtzeitig / yv.total) * 1000) / 10 : pct;
      const { trend, delta } = calcTrend(pct, pctG);
      return {
        fahrer_id: id,
        fahrer_name: driverNames[id] ?? id,
        puenktlichkeit_pct: pct,
        puenktlichkeit_pct_gestern: pctG,
        lieferungen_heute: v.total,
        rechtzeitig: v.rechtzeitig,
        trend,
        trend_delta: delta,
        ampel: calcAmpel(pct),
        alert_unpuenktlich: pct < 70,
      };
    });

    const filtered = driverId ? allFahrer.filter(f => f.fahrer_id === driverId) : allFahrer;
    const team = allFahrer.reduce((s, f) => s + f.puenktlichkeit_pct, 0) / (allFahrer.length || 1);

    return NextResponse.json({
      fahrer: filtered,
      team_durchschnitt: Math.round(team * 10) / 10,
      alert_count: allFahrer.filter(f => f.alert_unpuenktlich).length,
      generiert_am: new Date().toISOString(),
    } satisfies FahrerPuenktlichkeitV2Response);
  } catch {
    return NextResponse.json(buildMock(driverId));
  }
}
