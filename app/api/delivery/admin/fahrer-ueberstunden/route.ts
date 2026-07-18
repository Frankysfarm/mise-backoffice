import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';

function calcAmpel(ueberstunden_h: number): Ampel {
  if (ueberstunden_h <= 0) return 'gruen';
  if (ueberstunden_h <= 2) return 'gelb';
  return 'rot';
}

export interface FahrerUeberstunden {
  fahrer_id: string;
  fahrer_name: string;
  ueberstunden_h: number;
  ueberstunden_h_vw: number;
  schicht_dauer_h: number;
  soll_dauer_h: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: Ampel;
  alert_ueberstunden: boolean;
}

export interface FahrerUeberstundenResponse {
  fahrer: FahrerUeberstunden[];
  team_avg_ueberstunden: number;
  team_avg_ueberstunden_vw: number;
  alert_count: number;
  generiert_am: string;
}

function buildMock(_locationId: string, driverId?: string) {
  const drivers = [
    { id: 'd1', name: 'Max M.',   schicht: 9.5,  soll: 8.0, schicht_vw: 7.8,  soll_vw: 8.0 },
    { id: 'd2', name: 'Sara K.',  schicht: 10.5, soll: 8.0, schicht_vw: 10.8, soll_vw: 8.0 },
    { id: 'd3', name: 'Tim B.',   schicht: 7.5,  soll: 8.0, schicht_vw: 8.3,  soll_vw: 8.0 },
    { id: 'd4', name: 'Julia F.', schicht: 8.2,  soll: 8.0, schicht_vw: 8.5,  soll_vw: 8.0 },
  ];

  const fahrer: FahrerUeberstunden[] = drivers.map(d => {
    const ue = Math.round((d.schicht - d.soll) * 10) / 10;
    const ue_vw = Math.round((d.schicht_vw - d.soll_vw) * 10) / 10;
    return {
      fahrer_id: d.id,
      fahrer_name: d.name,
      ueberstunden_h: ue,
      ueberstunden_h_vw: ue_vw,
      schicht_dauer_h: d.schicht,
      soll_dauer_h: d.soll,
      trend: ue > ue_vw ? 'steigend' : ue < ue_vw ? 'fallend' : 'stabil',
      trend_delta: Math.round((ue - ue_vw) * 10) / 10,
      ampel: calcAmpel(ue),
      alert_ueberstunden: ue > 2,
    };
  }).sort((a, b) => b.ueberstunden_h - a.ueberstunden_h);

  const team_avg = Math.round((fahrer.reduce((s, f) => s + f.ueberstunden_h, 0) / fahrer.length) * 10) / 10;
  const team_avg_vw = Math.round((fahrer.reduce((s, f) => s + f.ueberstunden_h_vw, 0) / fahrer.length) * 10) / 10;
  const alert_count = fahrer.filter(f => f.alert_ueberstunden).length;

  if (driverId) {
    const f = fahrer.find(d => d.fahrer_id === driverId) ?? fahrer[0];
    return { fahrer_single: f, team_avg_ueberstunden: team_avg };
  }

  return { fahrer, team_avg_ueberstunden: team_avg, team_avg_ueberstunden_vw: team_avg_vw, alert_count, generiert_am: new Date().toISOString() };
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
      .select('id, name, soll_stunden')
      .eq('location_id', locationId)
      .eq('is_active', true);

    if (!drivers?.length) return NextResponse.json(buildMock(locationId, driverId));

    async function getSchichtDauer(dId: string, date: string): Promise<number> {
      const { data } = await supabase
        .from('driver_shifts')
        .select('started_at, ended_at')
        .eq('driver_id', dId)
        .gte('started_at', date + 'T00:00:00')
        .lte('started_at', date + 'T23:59:59');
      if (!data?.length) return 0;
      const durationMs = data.reduce((s, r) => {
        const end = r.ended_at ? new Date(r.ended_at).getTime() : Date.now();
        return s + (end - new Date(r.started_at).getTime());
      }, 0);
      return Math.round((durationMs / 3600000) * 10) / 10;
    }

    const results = await Promise.all(
      drivers.map(async d => {
        const soll = (d.soll_stunden as number | null) ?? 8;
        const [schicht, schicht_vw] = await Promise.all([
          getSchichtDauer(d.id, today),
          getSchichtDauer(d.id, lastWeek),
        ]);
        const ue = Math.round((schicht - soll) * 10) / 10;
        const ue_vw = Math.round((schicht_vw - soll) * 10) / 10;
        return {
          fahrer_id: d.id,
          fahrer_name: d.name,
          ueberstunden_h: ue,
          ueberstunden_h_vw: ue_vw,
          schicht_dauer_h: schicht,
          soll_dauer_h: soll,
          trend: ue > ue_vw ? 'steigend' : ue < ue_vw ? 'fallend' : 'stabil',
          trend_delta: Math.round((ue - ue_vw) * 10) / 10,
          ampel: calcAmpel(ue),
          alert_ueberstunden: ue > 2 && schicht > 0,
        } as FahrerUeberstunden;
      }),
    );

    const fahrer = results.sort((a, b) => b.ueberstunden_h - a.ueberstunden_h);
    const team_avg = fahrer.length
      ? Math.round((fahrer.reduce((s, f) => s + f.ueberstunden_h, 0) / fahrer.length) * 10) / 10
      : 0;
    const team_avg_vw = fahrer.length
      ? Math.round((fahrer.reduce((s, f) => s + f.ueberstunden_h_vw, 0) / fahrer.length) * 10) / 10
      : 0;
    const alert_count = fahrer.filter(f => f.alert_ueberstunden).length;

    if (driverId) {
      const f = fahrer.find(d => d.fahrer_id === driverId) ?? fahrer[0];
      return NextResponse.json({ fahrer_single: f, team_avg_ueberstunden: team_avg });
    }

    return NextResponse.json({ fahrer, team_avg_ueberstunden: team_avg, team_avg_ueberstunden_vw: team_avg_vw, alert_count, generiert_am: new Date().toISOString() });
  } catch (err) {
    console.error('fahrer-ueberstunden error', err);
    return NextResponse.json(buildMock(locationId, driverId));
  }
}
