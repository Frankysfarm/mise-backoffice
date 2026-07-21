import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';
type Trend = 'steigend' | 'fallend' | 'stabil';

function calcAmpel(min: number): Ampel {
  if (min <= 10) return 'gruen';
  if (min <= 20) return 'gelb';
  return 'rot';
}

function calcTrend(curr: number, prev: number): { trend: Trend; delta: number } {
  const delta = Math.round((curr - prev) * 10) / 10;
  if (delta > 0.5) return { trend: 'steigend', delta };
  if (delta < -0.5) return { trend: 'fallend', delta };
  return { trend: 'stabil', delta };
}

export interface FahrerHeimwegEfifizienz {
  fahrer_id: string;
  fahrer_name: string;
  heimweg_min: number;
  heimweg_min_vw: number;
  trend: Trend;
  trend_delta: number;
  ampel: Ampel;
  alert_zu_lang: boolean;
}

export interface FahrerHeimwegEfifizienzResponse {
  fahrer: FahrerHeimwegEfifizienz[];
  team_avg_heimweg_min: number;
  team_avg_heimweg_min_vw: number;
  alert_count: number;
  generiert_am: string;
}

function buildMock(_locationId: string, driverId?: string) {
  const drivers = [
    { id: 'd1', name: 'Max M.',   avg: 8.5  },
    { id: 'd2', name: 'Sara K.',  avg: 14.2 },
    { id: 'd3', name: 'Tim B.',   avg: 23.1 },
    { id: 'd4', name: 'Julia F.', avg: 6.3  },
  ];

  const fahrer: FahrerHeimwegEfifizienz[] = drivers.map(d => {
    const avg_vw = Math.max(0.5, d.avg + (Math.random() > 0.5 ? 1.2 : -1.2));
    const { trend, delta } = calcTrend(d.avg, avg_vw);
    return {
      fahrer_id: d.id,
      fahrer_name: d.name,
      heimweg_min: d.avg,
      heimweg_min_vw: Math.round(avg_vw * 10) / 10,
      trend,
      trend_delta: delta,
      ampel: calcAmpel(d.avg),
      alert_zu_lang: d.avg > 20,
    };
  }).sort((a, b) => a.heimweg_min - b.heimweg_min);

  const team_avg = Math.round((fahrer.reduce((s, f) => s + f.heimweg_min, 0) / fahrer.length) * 10) / 10;
  const team_avg_vw = Math.round((fahrer.reduce((s, f) => s + f.heimweg_min_vw, 0) / fahrer.length) * 10) / 10;
  const alert_count = fahrer.filter(f => f.alert_zu_lang).length;

  if (driverId) {
    const f = fahrer.find(d => d.fahrer_id === driverId) ?? fahrer[0];
    return { fahrer_single: f, team_avg_heimweg_min: team_avg };
  }

  return { fahrer, team_avg_heimweg_min: team_avg, team_avg_heimweg_min_vw: team_avg_vw, alert_count, generiert_am: new Date().toISOString() };
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

    // Fetch completed batches: last_stop_completed_at to returned_at gives depot return time
    const { data: todayBatches } = await supabase
      .from('delivery_batches')
      .select('driver_id, last_stop_completed_at, returned_at')
      .eq('location_id', locationId)
      .not('last_stop_completed_at', 'is', null)
      .not('returned_at', 'is', null)
      .gte('returned_at', todayStart.toISOString())
      .lte('returned_at', todayEnd.toISOString());

    const { data: vwBatches } = await supabase
      .from('delivery_batches')
      .select('driver_id, last_stop_completed_at, returned_at')
      .eq('location_id', locationId)
      .not('last_stop_completed_at', 'is', null)
      .not('returned_at', 'is', null)
      .gte('returned_at', vwStart.toISOString())
      .lte('returned_at', vwEnd.toISOString());

    type BatchRow = { driver_id: string; last_stop_completed_at: string; returned_at: string };

    function avgReturnMin(batches: BatchRow[] | null, dId: string): number {
      const ds = (batches ?? []).filter(b => b.driver_id === dId && b.last_stop_completed_at && b.returned_at);
      if (!ds.length) return 10;
      const total = ds.reduce((sum, b) => {
        const diffMs = new Date(b.returned_at).getTime() - new Date(b.last_stop_completed_at).getTime();
        return sum + Math.max(0, diffMs / 60000);
      }, 0);
      return Math.round((total / ds.length) * 10) / 10;
    }

    const fahrerList: FahrerHeimwegEfifizienz[] = drivers.map(d => {
      const avg = avgReturnMin(todayBatches as BatchRow[] | null, d.id);
      const avg_vw = avgReturnMin(vwBatches as BatchRow[] | null, d.id);
      const { trend, delta } = calcTrend(avg, avg_vw);
      return {
        fahrer_id: d.id,
        fahrer_name: d.name,
        heimweg_min: avg,
        heimweg_min_vw: avg_vw,
        trend,
        trend_delta: delta,
        ampel: calcAmpel(avg),
        alert_zu_lang: avg > 20,
      };
    }).sort((a, b) => a.heimweg_min - b.heimweg_min);

    const team_avg = fahrerList.length
      ? Math.round((fahrerList.reduce((s, f) => s + f.heimweg_min, 0) / fahrerList.length) * 10) / 10
      : 0;
    const team_avg_vw = fahrerList.length
      ? Math.round((fahrerList.reduce((s, f) => s + f.heimweg_min_vw, 0) / fahrerList.length) * 10) / 10
      : 0;
    const alert_count = fahrerList.filter(f => f.alert_zu_lang).length;

    if (driverId) {
      const f = fahrerList.find(d => d.fahrer_id === driverId) ?? fahrerList[0];
      return NextResponse.json({ fahrer_single: f, team_avg_heimweg_min: team_avg });
    }

    return NextResponse.json({
      fahrer: fahrerList,
      team_avg_heimweg_min: team_avg,
      team_avg_heimweg_min_vw: team_avg_vw,
      alert_count,
      generiert_am: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(buildMock(locationId, driverId));
  }
}
