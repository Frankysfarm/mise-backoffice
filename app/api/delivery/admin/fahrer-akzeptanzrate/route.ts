import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';
type Trend = 'steigend' | 'fallend' | 'stabil';

function calcAmpel(rate: number): Ampel {
  if (rate >= 90) return 'gruen';
  if (rate >= 70) return 'gelb';
  return 'rot';
}

function calcTrend(cur: number, prev: number): Trend {
  if (cur > prev + 1) return 'steigend';
  if (cur < prev - 1) return 'fallend';
  return 'stabil';
}

export interface FahrerAkzeptanzrate {
  fahrer_id: string;
  fahrer_name: string;
  akzeptanzrate: number;
  akzeptanzrate_vw: number;
  angenommen: number;
  angeboten: number;
  trend: Trend;
  trend_delta: number;
  ampel: Ampel;
  alert_niedrig: boolean;
}

export interface FahrerAkzeptanzrateResponse {
  fahrer: FahrerAkzeptanzrate[];
  team_avg_rate: number;
  team_avg_rate_vw: number;
  alert_count: number;
  generiert_am: string;
}

function buildMock(locationId: string, driverId?: string): FahrerAkzeptanzrateResponse | { fahrer_single: FahrerAkzeptanzrate; team_avg_rate: number } {
  const drivers = [
    { id: 'd1', name: 'Max M.',   ang: 22, angeboten: 23, ang_vw: 20, angeboten_vw: 23 },
    { id: 'd2', name: 'Sara K.',  ang: 17, angeboten: 20, ang_vw: 16, angeboten_vw: 19 },
    { id: 'd3', name: 'Tim B.',   ang: 10, angeboten: 18, ang_vw: 14, angeboten_vw: 18 },
    { id: 'd4', name: 'Julia F.', ang: 21, angeboten: 22, ang_vw: 19, angeboten_vw: 21 },
  ];

  const fahrer: FahrerAkzeptanzrate[] = drivers.map(d => {
    const rate = d.angeboten > 0 ? Math.round((d.ang / d.angeboten) * 1000) / 10 : 0;
    const rate_vw = d.angeboten_vw > 0 ? Math.round((d.ang_vw / d.angeboten_vw) * 1000) / 10 : 0;
    return {
      fahrer_id: d.id,
      fahrer_name: d.name,
      akzeptanzrate: rate,
      akzeptanzrate_vw: rate_vw,
      angenommen: d.ang,
      angeboten: d.angeboten,
      trend: calcTrend(rate, rate_vw),
      trend_delta: Math.round((rate - rate_vw) * 10) / 10,
      ampel: calcAmpel(rate),
      alert_niedrig: rate < 70,
    };
  }).sort((a, b) => a.akzeptanzrate - b.akzeptanzrate);

  const team_avg_rate = Math.round((fahrer.reduce((s, f) => s + f.akzeptanzrate, 0) / fahrer.length) * 10) / 10;
  const team_avg_rate_vw = Math.round((fahrer.reduce((s, f) => s + f.akzeptanzrate_vw, 0) / fahrer.length) * 10) / 10;
  const alert_count = fahrer.filter(f => f.alert_niedrig).length;

  if (driverId) {
    const f = fahrer.find(d => d.fahrer_id === driverId) ?? fahrer[0];
    return { fahrer_single: f, team_avg_rate };
  }

  return { fahrer, team_avg_rate, team_avg_rate_vw, alert_count, generiert_am: new Date().toISOString() };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const driverId = searchParams.get('driver_id') ?? undefined;

  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const supabase = createServiceClient();
    const today = new Date().toISOString().slice(0, 10);
    const lastWeek = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);

    const { data: drivers } = await supabase
      .from('drivers')
      .select('id, name')
      .eq('location_id', locationId)
      .eq('is_active', true);

    if (!drivers?.length) return NextResponse.json(buildMock(locationId, driverId));

    async function getAkzeptanzDaten(dId: string, date: string): Promise<{ angenommen: number; angeboten: number }> {
      const { data } = await supabase
        .from('driver_assignments')
        .select('status')
        .eq('driver_id', dId)
        .eq('location_id', locationId)
        .gte('created_at', date + 'T00:00:00')
        .lte('created_at', date + 'T23:59:59');
      const angeboten = data?.length ?? 0;
      const angenommen = data?.filter(r => r.status === 'accepted').length ?? 0;
      return { angenommen, angeboten };
    }

    const results = await Promise.all(
      drivers.map(async d => {
        const [today_daten, vw_daten] = await Promise.all([
          getAkzeptanzDaten(d.id, today),
          getAkzeptanzDaten(d.id, lastWeek),
        ]);
        const rate = today_daten.angeboten > 0
          ? Math.round((today_daten.angenommen / today_daten.angeboten) * 1000) / 10
          : 0;
        const rate_vw = vw_daten.angeboten > 0
          ? Math.round((vw_daten.angenommen / vw_daten.angeboten) * 1000) / 10
          : 0;
        return {
          fahrer_id: d.id,
          fahrer_name: d.name,
          akzeptanzrate: rate,
          akzeptanzrate_vw: rate_vw,
          angenommen: today_daten.angenommen,
          angeboten: today_daten.angeboten,
          trend: calcTrend(rate, rate_vw),
          trend_delta: Math.round((rate - rate_vw) * 10) / 10,
          ampel: calcAmpel(rate),
          alert_niedrig: rate < 70 && today_daten.angeboten > 0,
        } as FahrerAkzeptanzrate;
      }),
    );

    const fahrer = results.sort((a, b) => a.akzeptanzrate - b.akzeptanzrate);
    const team_avg_rate = fahrer.length
      ? Math.round((fahrer.reduce((s, f) => s + f.akzeptanzrate, 0) / fahrer.length) * 10) / 10
      : 0;
    const team_avg_rate_vw = fahrer.length
      ? Math.round((fahrer.reduce((s, f) => s + f.akzeptanzrate_vw, 0) / fahrer.length) * 10) / 10
      : 0;
    const alert_count = fahrer.filter(f => f.alert_niedrig).length;

    if (driverId) {
      const f = fahrer.find(d => d.fahrer_id === driverId) ?? fahrer[0];
      return NextResponse.json({ fahrer_single: f, team_avg_rate });
    }

    return NextResponse.json({ fahrer, team_avg_rate, team_avg_rate_vw, alert_count, generiert_am: new Date().toISOString() });
  } catch (err) {
    console.error('fahrer-akzeptanzrate error', err);
    return NextResponse.json(buildMock(locationId, driverId));
  }
}
