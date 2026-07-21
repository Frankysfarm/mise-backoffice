import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';
type Trend = 'steigend' | 'fallend' | 'stabil';

function calcAmpel(min: number): Ampel {
  if (min <= 25) return 'gruen';
  if (min <= 35) return 'gelb';
  return 'rot';
}

function calcTrend(curr: number, prev: number): { trend: Trend; delta: number } {
  const delta = Math.round((curr - prev) * 10) / 10;
  if (delta > 0.5) return { trend: 'steigend', delta };
  if (delta < -0.5) return { trend: 'fallend', delta };
  return { trend: 'stabil', delta };
}

export interface FahrerDurchschnittsLieferzeit {
  fahrer_id: string;
  fahrer_name: string;
  avg_min: number;
  avg_min_gestern: number;
  trend: Trend;
  trend_delta: number;
  ampel: Ampel;
  alert_zu_lang: boolean;
}

export interface FahrerDurchschnittsLieferzeitResponse {
  fahrer: FahrerDurchschnittsLieferzeit[];
  team_avg_min: number;
  team_avg_min_gestern: number;
  alert_count: number;
  generiert_am: string;
}

function buildMock(_locationId: string, driverId?: string) {
  const drivers = [
    { id: 'd1', name: 'Max M.',   avg: 22.5 },
    { id: 'd2', name: 'Sara K.',  avg: 27.8 },
    { id: 'd3', name: 'Tim B.',   avg: 38.2 },
    { id: 'd4', name: 'Julia F.', avg: 24.1 },
  ];

  const fahrer: FahrerDurchschnittsLieferzeit[] = drivers.map(d => {
    const avg_gestern = Math.max(5, d.avg + (Math.random() > 0.5 ? 2.5 : -2.5));
    const { trend, delta } = calcTrend(d.avg, avg_gestern);
    return {
      fahrer_id: d.id,
      fahrer_name: d.name,
      avg_min: d.avg,
      avg_min_gestern: Math.round(avg_gestern * 10) / 10,
      trend,
      trend_delta: delta,
      ampel: calcAmpel(d.avg),
      alert_zu_lang: d.avg > 35,
    };
  }).sort((a, b) => a.avg_min - b.avg_min);

  const team_avg = Math.round((fahrer.reduce((s, f) => s + f.avg_min, 0) / fahrer.length) * 10) / 10;
  const team_avg_gestern = Math.round((fahrer.reduce((s, f) => s + f.avg_min_gestern, 0) / fahrer.length) * 10) / 10;
  const alert_count = fahrer.filter(f => f.alert_zu_lang).length;

  if (driverId) {
    const f = fahrer.find(d => d.fahrer_id === driverId) ?? fahrer[0];
    return { fahrer_single: f, team_avg_min: team_avg };
  }

  return { fahrer, team_avg_min: team_avg, team_avg_min_gestern: team_avg_gestern, alert_count, generiert_am: new Date().toISOString() };
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
    const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const gesternStart = new Date(todayStart); gesternStart.setDate(gesternStart.getDate() - 1);
    const gesternEnd   = new Date(todayEnd);   gesternEnd.setDate(gesternEnd.getDate() - 1);

    const { data: todayStops } = await supabase
      .from('batch_stops')
      .select('driver_id, created_at, delivered_at')
      .eq('location_id', locationId)
      .in('status', ['completed', 'delivered'])
      .not('created_at', 'is', null)
      .not('delivered_at', 'is', null)
      .gte('created_at', todayStart.toISOString())
      .lte('created_at', todayEnd.toISOString());

    const { data: gesternStops } = await supabase
      .from('batch_stops')
      .select('driver_id, created_at, delivered_at')
      .eq('location_id', locationId)
      .in('status', ['completed', 'delivered'])
      .not('created_at', 'is', null)
      .not('delivered_at', 'is', null)
      .gte('created_at', gesternStart.toISOString())
      .lte('created_at', gesternEnd.toISOString());

    function avgDeliveryMin(
      stops: { driver_id: string; created_at: string; delivered_at: string }[] | null,
      dId: string
    ): number {
      const ds = (stops ?? []).filter(s => s.driver_id === dId && s.created_at && s.delivered_at);
      if (!ds.length) return 28;
      const total = ds.reduce((sum, s) => {
        const diffMs = new Date(s.delivered_at).getTime() - new Date(s.created_at).getTime();
        return sum + Math.max(0, diffMs / 60000);
      }, 0);
      return Math.round((total / ds.length) * 10) / 10;
    }

    const fahrerList: FahrerDurchschnittsLieferzeit[] = drivers.map(d => {
      const avg       = avgDeliveryMin(todayStops   as { driver_id: string; created_at: string; delivered_at: string }[] | null, d.id);
      const avg_gestern = avgDeliveryMin(gesternStops as { driver_id: string; created_at: string; delivered_at: string }[] | null, d.id);
      const { trend, delta } = calcTrend(avg, avg_gestern);
      return {
        fahrer_id: d.id,
        fahrer_name: d.name,
        avg_min: avg,
        avg_min_gestern: avg_gestern,
        trend,
        trend_delta: delta,
        ampel: calcAmpel(avg),
        alert_zu_lang: avg > 35,
      };
    }).sort((a, b) => a.avg_min - b.avg_min);

    const team_avg = fahrerList.length
      ? Math.round((fahrerList.reduce((s, f) => s + f.avg_min, 0) / fahrerList.length) * 10) / 10
      : 0;
    const team_avg_gestern = fahrerList.length
      ? Math.round((fahrerList.reduce((s, f) => s + f.avg_min_gestern, 0) / fahrerList.length) * 10) / 10
      : 0;
    const alert_count = fahrerList.filter(f => f.alert_zu_lang).length;

    if (driverId) {
      const f = fahrerList.find(d => d.fahrer_id === driverId) ?? fahrerList[0];
      return NextResponse.json({ fahrer_single: f, team_avg_min: team_avg });
    }

    return NextResponse.json({
      fahrer: fahrerList,
      team_avg_min: team_avg,
      team_avg_min_gestern: team_avg_gestern,
      alert_count,
      generiert_am: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(buildMock(locationId, driverId));
  }
}
