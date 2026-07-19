import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';
type Trend = 'steigend' | 'fallend' | 'stabil';

function calcAmpel(minPerStop: number): Ampel {
  if (minPerStop <= 20) return 'gruen';
  if (minPerStop <= 30) return 'gelb';
  return 'rot';
}

function calcTrend(curr: number, prev: number): { trend: Trend; delta: number } {
  const delta = Math.round((curr - prev) * 10) / 10;
  if (delta > 1) return { trend: 'steigend', delta };
  if (delta < -1) return { trend: 'fallend', delta };
  return { trend: 'stabil', delta };
}

export interface FahrerLieferzeitEfzizienz {
  fahrer_id: string;
  fahrer_name: string;
  avg_lieferzeit_min: number;
  avg_lieferzeit_min_vw: number;
  trend: Trend;
  trend_delta: number;
  ampel: Ampel;
  alert_zu_langsam: boolean;
}

export interface FahrerLieferzeitEffizienzResponse {
  fahrer: FahrerLieferzeitEfzizienz[];
  team_avg_lieferzeit_min: number;
  team_avg_lieferzeit_min_vw: number;
  alert_count: number;
  generiert_am: string;
}

function buildMock(_locationId: string, driverId?: string) {
  const drivers = [
    { id: 'd1', name: 'Max M.',   avg: 18 },
    { id: 'd2', name: 'Sara K.',  avg: 24 },
    { id: 'd3', name: 'Tim B.',   avg: 33 },
    { id: 'd4', name: 'Julia F.', avg: 16 },
  ];

  const fahrer: FahrerLieferzeitEfzizienz[] = drivers.map(d => {
    const avg_vw = Math.max(1, d.avg + (Math.random() > 0.5 ? 2 : -2));
    const { trend, delta } = calcTrend(d.avg, avg_vw);
    return {
      fahrer_id: d.id,
      fahrer_name: d.name,
      avg_lieferzeit_min: d.avg,
      avg_lieferzeit_min_vw: Math.round(avg_vw),
      trend,
      trend_delta: delta,
      ampel: calcAmpel(d.avg),
      alert_zu_langsam: d.avg > 30,
    };
  }).sort((a, b) => a.avg_lieferzeit_min - b.avg_lieferzeit_min);

  const team_avg = Math.round((fahrer.reduce((s, f) => s + f.avg_lieferzeit_min, 0) / fahrer.length) * 10) / 10;
  const team_avg_vw = Math.round((fahrer.reduce((s, f) => s + f.avg_lieferzeit_min_vw, 0) / fahrer.length) * 10) / 10;
  const alert_count = fahrer.filter(f => f.alert_zu_langsam).length;

  if (driverId) {
    const f = fahrer.find(d => d.fahrer_id === driverId) ?? fahrer[0];
    return { fahrer_single: f, team_avg_lieferzeit_min: team_avg };
  }

  return { fahrer, team_avg_lieferzeit_min: team_avg, team_avg_lieferzeit_min_vw: team_avg_vw, alert_count, generiert_am: new Date().toISOString() };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const driverId = searchParams.get('driver_id') ?? undefined;

  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const supabase = createServiceClient();

    const { data: drivers, error: dErr } = await supabase
      .from('drivers')
      .select('id, name, location_id')
      .eq('location_id', locationId)
      .eq('is_active', true);

    if (dErr || !drivers?.length) {
      return NextResponse.json(buildMock(locationId, driverId));
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const vwStart = new Date(todayStart); vwStart.setDate(vwStart.getDate() - 7);
    const vwEnd = new Date(todayEnd); vwEnd.setDate(vwEnd.getDate() - 7);

    const { data: todayStops } = await supabase
      .from('batch_stops')
      .select('batch_id, driver_id, arrived_at, departed_at')
      .eq('location_id', locationId)
      .not('arrived_at', 'is', null)
      .not('departed_at', 'is', null)
      .gte('arrived_at', todayStart.toISOString())
      .lte('arrived_at', todayEnd.toISOString());

    const { data: vwStops } = await supabase
      .from('batch_stops')
      .select('batch_id, driver_id, arrived_at, departed_at')
      .eq('location_id', locationId)
      .not('arrived_at', 'is', null)
      .not('departed_at', 'is', null)
      .gte('arrived_at', vwStart.toISOString())
      .lte('arrived_at', vwEnd.toISOString());

    function avgStopMin(stops: { driver_id: string; arrived_at: string; departed_at: string }[] | null, dId: string): number {
      const driverStops = (stops ?? []).filter(s => s.driver_id === dId && s.arrived_at && s.departed_at);
      if (!driverStops.length) return 20;
      const total = driverStops.reduce((sum, s) => {
        const diffMs = new Date(s.departed_at).getTime() - new Date(s.arrived_at).getTime();
        return sum + Math.max(0, diffMs / 60000);
      }, 0);
      return Math.round((total / driverStops.length) * 10) / 10;
    }

    const fahrerList: FahrerLieferzeitEfzizienz[] = drivers.map(d => {
      const avg = avgStopMin(todayStops as { driver_id: string; arrived_at: string; departed_at: string }[] | null, d.id);
      const avg_vw = avgStopMin(vwStops as { driver_id: string; arrived_at: string; departed_at: string }[] | null, d.id);
      const { trend, delta } = calcTrend(avg, avg_vw);
      return {
        fahrer_id: d.id,
        fahrer_name: d.name,
        avg_lieferzeit_min: avg,
        avg_lieferzeit_min_vw: avg_vw,
        trend,
        trend_delta: delta,
        ampel: calcAmpel(avg),
        alert_zu_langsam: avg > 30,
      };
    }).sort((a, b) => a.avg_lieferzeit_min - b.avg_lieferzeit_min);

    const team_avg = fahrerList.length
      ? Math.round((fahrerList.reduce((s, f) => s + f.avg_lieferzeit_min, 0) / fahrerList.length) * 10) / 10
      : 0;
    const team_avg_vw = fahrerList.length
      ? Math.round((fahrerList.reduce((s, f) => s + f.avg_lieferzeit_min_vw, 0) / fahrerList.length) * 10) / 10
      : 0;
    const alert_count = fahrerList.filter(f => f.alert_zu_langsam).length;

    if (driverId) {
      const f = fahrerList.find(d => d.fahrer_id === driverId) ?? fahrerList[0];
      return NextResponse.json({ fahrer_single: f, team_avg_lieferzeit_min: team_avg });
    }

    return NextResponse.json({
      fahrer: fahrerList,
      team_avg_lieferzeit_min: team_avg,
      team_avg_lieferzeit_min_vw: team_avg_vw,
      alert_count,
      generiert_am: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(buildMock(locationId, driverId));
  }
}
