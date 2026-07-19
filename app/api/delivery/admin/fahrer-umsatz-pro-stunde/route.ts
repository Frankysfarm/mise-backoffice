import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';

function calcAmpel(uph: number): Ampel {
  if (uph >= 12) return 'gruen';
  if (uph >= 8) return 'gelb';
  return 'rot';
}

export interface FahrerUmsatzProStunde {
  fahrer_id: string;
  fahrer_name: string;
  umsatz_pro_stunde: number;
  uph_vw: number;
  einnahmen: number;
  schichtdauer_h: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: Ampel;
  alert_ineffizient: boolean;
}

export interface FahrerUmsatzProStundeResponse {
  fahrer: FahrerUmsatzProStunde[];
  team_avg_uph: number;
  team_avg_uph_vw: number;
  alert_count: number;
  generiert_am: string;
}

function buildMock(locationId: string, driverId?: string) {
  const drivers = [
    { id: 'd1', name: 'Max M.', einnahmen: 135, dauer: 7.5, einnahmen_vw: 120, dauer_vw: 7.0 },
    { id: 'd2', name: 'Sara K.', einnahmen: 98, dauer: 8.0, einnahmen_vw: 95, dauer_vw: 7.5 },
    { id: 'd3', name: 'Tim B.', einnahmen: 45, dauer: 10.5, einnahmen_vw: 70, dauer_vw: 9.0 },
    { id: 'd4', name: 'Julia F.', einnahmen: 112, dauer: 6.5, einnahmen_vw: 105, dauer_vw: 6.0 },
  ];

  const fahrer: FahrerUmsatzProStunde[] = drivers.map(d => {
    const uph = d.dauer > 0 ? Math.round((d.einnahmen / d.dauer) * 10) / 10 : 0;
    const uph_vw = d.dauer_vw > 0 ? Math.round((d.einnahmen_vw / d.dauer_vw) * 10) / 10 : 0;
    return {
      fahrer_id: d.id,
      fahrer_name: d.name,
      umsatz_pro_stunde: uph,
      uph_vw,
      einnahmen: d.einnahmen,
      schichtdauer_h: d.dauer,
      trend: (uph > uph_vw ? 'steigend' : uph < uph_vw ? 'fallend' : 'stabil') as 'steigend' | 'fallend' | 'stabil',
      trend_delta: Math.round((uph - uph_vw) * 10) / 10,
      ampel: calcAmpel(uph),
      alert_ineffizient: uph < 8,
    };
  }).sort((a, b) => b.umsatz_pro_stunde - a.umsatz_pro_stunde);

  const team_avg_uph = Math.round((fahrer.reduce((s, f) => s + f.umsatz_pro_stunde, 0) / fahrer.length) * 10) / 10;
  const team_avg_uph_vw = Math.round((fahrer.reduce((s, f) => s + f.uph_vw, 0) / fahrer.length) * 10) / 10;
  const alert_count = fahrer.filter(f => f.alert_ineffizient).length;

  if (driverId) {
    const f = fahrer.find(d => d.fahrer_id === driverId) ?? fahrer[0];
    return { fahrer_single: f, team_avg_uph };
  }

  return { fahrer, team_avg_uph, team_avg_uph_vw, alert_count, generiert_am: new Date().toISOString() };
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

    async function getEinnahmen(dId: string, date: string): Promise<number> {
      const { data } = await supabase
        .from('delivery_tours')
        .select('earnings')
        .eq('driver_id', dId)
        .gte('created_at', date + 'T00:00:00')
        .lte('created_at', date + 'T23:59:59')
        .not('earnings', 'is', null);
      return data?.reduce((s, r) => s + (r.earnings ?? 0), 0) ?? 0;
    }

    async function getSchichtdauer(dId: string, date: string): Promise<number> {
      const { data } = await supabase
        .from('driver_shifts')
        .select('start_time, end_time')
        .eq('driver_id', dId)
        .gte('start_time', date + 'T00:00:00')
        .lte('start_time', date + 'T23:59:59')
        .limit(1)
        .single();
      if (!data) return 0;
      const end = data.end_time ? new Date(data.end_time) : new Date();
      const start = new Date(data.start_time);
      return Math.round(((end.getTime() - start.getTime()) / 3600000) * 10) / 10;
    }

    const results = await Promise.all(
      drivers.map(async d => {
        const [einnahmen, einnahmen_vw, schichtdauer_h, schichtdauer_h_vw] = await Promise.all([
          getEinnahmen(d.id, today),
          getEinnahmen(d.id, lastWeek),
          getSchichtdauer(d.id, today),
          getSchichtdauer(d.id, lastWeek),
        ]);
        const uph = schichtdauer_h > 0 ? Math.round((einnahmen / schichtdauer_h) * 10) / 10 : 0;
        const uph_vw = schichtdauer_h_vw > 0 ? Math.round((einnahmen_vw / schichtdauer_h_vw) * 10) / 10 : 0;
        return {
          fahrer_id: d.id,
          fahrer_name: d.name,
          umsatz_pro_stunde: uph,
          uph_vw,
          einnahmen,
          schichtdauer_h,
          trend: (uph > uph_vw ? 'steigend' : uph < uph_vw ? 'fallend' : 'stabil') as 'steigend' | 'fallend' | 'stabil',
          trend_delta: Math.round((uph - uph_vw) * 10) / 10,
          ampel: calcAmpel(uph),
          alert_ineffizient: uph < 8 && schichtdauer_h > 0,
        } as FahrerUmsatzProStunde;
      }),
    );

    const fahrer = results.sort((a, b) => b.umsatz_pro_stunde - a.umsatz_pro_stunde);
    const team_avg_uph = fahrer.length
      ? Math.round((fahrer.reduce((s, f) => s + f.umsatz_pro_stunde, 0) / fahrer.length) * 10) / 10
      : 0;
    const team_avg_uph_vw = fahrer.length
      ? Math.round((fahrer.reduce((s, f) => s + f.uph_vw, 0) / fahrer.length) * 10) / 10
      : 0;
    const alert_count = fahrer.filter(f => f.alert_ineffizient).length;

    if (driverId) {
      const f = fahrer.find(d => d.fahrer_id === driverId) ?? fahrer[0];
      return NextResponse.json({ fahrer_single: f, team_avg_uph });
    }

    return NextResponse.json({ fahrer, team_avg_uph, team_avg_uph_vw, alert_count, generiert_am: new Date().toISOString() });
  } catch (err) {
    console.error('fahrer-umsatz-pro-stunde error', err);
    return NextResponse.json(buildMock(locationId, driverId));
  }
}
