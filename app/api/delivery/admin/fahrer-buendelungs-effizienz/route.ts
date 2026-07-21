import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';
type Trend = 'steigend' | 'fallend' | 'stabil';

function calcAmpel(avg: number): Ampel {
  if (avg >= 3) return 'gruen';
  if (avg >= 2) return 'gelb';
  return 'rot';
}

function calcTrend(curr: number, prev: number): { trend: Trend; delta: number } {
  const delta = Math.round((curr - prev) * 10) / 10;
  if (delta > 0.1) return { trend: 'steigend', delta };
  if (delta < -0.1) return { trend: 'fallend', delta };
  return { trend: 'stabil', delta };
}

export interface FahrerBuendelungsEflizienz {
  fahrer_id: string;
  fahrer_name: string;
  avg_stopps: number;
  touren_heute: number;
  avg_stopps_vw: number;
  trend: Trend;
  trend_delta: number;
  ampel: Ampel;
  alert_niedrig: boolean;
}

export interface BuendelungsEffizienzResponse {
  fahrer: FahrerBuendelungsEflizienz[];
  team_avg_stopps: number;
  alert_count: number;
  generiert_am: string;
}

function buildMock(_locationId: string, driverId?: string) {
  const drivers = [
    { id: 'd1', name: 'Julia F.', stopps: 4.2, touren: 11, stopps_vw: 3.8 },
    { id: 'd2', name: 'Max M.',   stopps: 3.6, touren: 9,  stopps_vw: 3.9 },
    { id: 'd3', name: 'Sara K.',  stopps: 2.1, touren: 8,  stopps_vw: 2.4 },
    { id: 'd4', name: 'Tim B.',   stopps: 1.3, touren: 6,  stopps_vw: 1.0 },
  ];

  const fahrer: FahrerBuendelungsEflizienz[] = drivers
    .sort((a, b) => b.stopps - a.stopps)
    .map(d => {
      const { trend, delta } = calcTrend(d.stopps, d.stopps_vw);
      return {
        fahrer_id: d.id,
        fahrer_name: d.name,
        avg_stopps: d.stopps,
        touren_heute: d.touren,
        avg_stopps_vw: d.stopps_vw,
        trend,
        trend_delta: delta,
        ampel: calcAmpel(d.stopps),
        alert_niedrig: d.stopps < 2,
      };
    });

  const team_avg = Math.round(fahrer.reduce((s, f) => s + f.avg_stopps, 0) / fahrer.length * 10) / 10;

  if (driverId) {
    const f = fahrer.find(d => d.fahrer_id === driverId) ?? fahrer[0];
    return { fahrer_single: f, team_avg_stopps: team_avg };
  }

  return {
    fahrer,
    team_avg_stopps: team_avg,
    alert_count: fahrer.filter(f => f.alert_niedrig).length,
    generiert_am: new Date().toISOString(),
  };
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
    const vwStart = new Date(todayStart); vwStart.setDate(vwStart.getDate() - 1);
    const vwEnd = new Date(todayEnd); vwEnd.setDate(vwEnd.getDate() - 1);

    type BatchRow = { driver_id: string; id: string };
    type StopRow = { batch_id: string };

    const { data: todayBatches } = await supabase
      .from('delivery_batches')
      .select('id, driver_id')
      .eq('location_id', locationId)
      .gte('created_at', todayStart.toISOString())
      .lte('created_at', todayEnd.toISOString());

    const { data: vwBatches } = await supabase
      .from('delivery_batches')
      .select('id, driver_id')
      .eq('location_id', locationId)
      .gte('created_at', vwStart.toISOString())
      .lte('created_at', vwEnd.toISOString());

    const todayBatchIds = (todayBatches as BatchRow[] | null ?? []).map(b => b.id);
    const vwBatchIds = (vwBatches as BatchRow[] | null ?? []).map(b => b.id);

    const { data: todayStops } = todayBatchIds.length
      ? await supabase.from('batch_stops').select('batch_id').in('batch_id', todayBatchIds)
      : { data: [] as StopRow[] };

    const { data: vwStops } = vwBatchIds.length
      ? await supabase.from('batch_stops').select('batch_id').in('batch_id', vwBatchIds)
      : { data: [] as StopRow[] };

    function calcAvgStopps(batches: BatchRow[], stops: StopRow[], dId: string) {
      const dBatches = batches.filter(b => b.driver_id === dId);
      if (!dBatches.length) return { avg: 2.0, touren: 0 };
      const batchIds = new Set(dBatches.map(b => b.id));
      const dStops = (stops ?? []).filter(s => batchIds.has(s.batch_id));
      const avg = dBatches.length > 0 ? dStops.length / dBatches.length : 0;
      return { avg: Math.round(avg * 10) / 10, touren: dBatches.length };
    }

    const fahrerList: FahrerBuendelungsEflizienz[] = drivers.map(d => {
      const { avg: avgHeute, touren } = calcAvgStopps(
        todayBatches as BatchRow[] ?? [],
        todayStops as StopRow[] ?? [],
        d.id
      );
      const { avg: avgVw } = calcAvgStopps(
        vwBatches as BatchRow[] ?? [],
        vwStops as StopRow[] ?? [],
        d.id
      );
      const { trend, delta } = calcTrend(avgHeute, avgVw);
      return {
        fahrer_id: d.id,
        fahrer_name: d.name,
        avg_stopps: avgHeute,
        touren_heute: touren,
        avg_stopps_vw: avgVw,
        trend,
        trend_delta: delta,
        ampel: calcAmpel(avgHeute),
        alert_niedrig: avgHeute < 2,
      };
    }).sort((a, b) => b.avg_stopps - a.avg_stopps);

    const team_avg = fahrerList.length
      ? Math.round(fahrerList.reduce((s, f) => s + f.avg_stopps, 0) / fahrerList.length * 10) / 10
      : 0;

    if (driverId) {
      const f = fahrerList.find(d => d.fahrer_id === driverId) ?? fahrerList[0];
      return NextResponse.json({ fahrer_single: f, team_avg_stopps: team_avg });
    }

    return NextResponse.json({
      fahrer: fahrerList,
      team_avg_stopps: team_avg,
      alert_count: fahrerList.filter(f => f.alert_niedrig).length,
      generiert_am: new Date().toISOString(),
    } satisfies BuendelungsEffizienzResponse);
  } catch {
    return NextResponse.json(buildMock(locationId, driverId));
  }
}
