import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'rot';

function calcAmpel(einnahmen: number, bewertung: number, touren: number): Ampel {
  if (einnahmen >= 80 && bewertung >= 4.0 && touren >= 5) return 'gruen';
  return 'rot';
}

export interface FahrerSchichtBilanz {
  fahrer_id: string;
  fahrer_name: string;
  touren: number;
  touren_vw: number;
  gesamt_km: number;
  gesamt_km_vw: number;
  einnahmen: number;
  einnahmen_vw: number;
  bewertung: number;
  bewertung_vw: number;
  schichtdauer_h: number;
  schichtdauer_h_vw: number;
  trend_einnahmen: 'steigend' | 'fallend' | 'stabil';
  trend_delta_einnahmen: number;
  ampel: Ampel;
  alert_schicht: boolean;
}

export interface FahrerSchichtBilanzResponse {
  fahrer: FahrerSchichtBilanz[];
  team_touren: number;
  team_einnahmen: number;
  alert_count: number;
  generiert_am: string;
}

function buildMock(locationId: string, driverId?: string) {
  const drivers = [
    { id: 'd1', name: 'Max M.', touren: 9, km: 54, einnahmen: 135, bew: 4.7, dauer: 7.5, touren_vw: 8, km_vw: 48, einnahmen_vw: 120, bew_vw: 4.5, dauer_vw: 7.0 },
    { id: 'd2', name: 'Sara K.', touren: 7, km: 42, einnahmen: 98, bew: 4.2, dauer: 8.0, touren_vw: 7, km_vw: 40, einnahmen_vw: 95, bew_vw: 4.1, dauer_vw: 7.5 },
    { id: 'd3', name: 'Tim B.', touren: 3, km: 22, einnahmen: 45, bew: 3.5, dauer: 10.5, touren_vw: 5, km_vw: 30, einnahmen_vw: 70, bew_vw: 3.8, dauer_vw: 9.0 },
    { id: 'd4', name: 'Julia F.', touren: 8, km: 40, einnahmen: 112, bew: 4.9, dauer: 6.5, touren_vw: 7, km_vw: 38, einnahmen_vw: 105, bew_vw: 4.8, dauer_vw: 6.0 },
  ];

  const fahrer: FahrerSchichtBilanz[] = drivers.map(d => ({
    fahrer_id: d.id,
    fahrer_name: d.name,
    touren: d.touren,
    touren_vw: d.touren_vw,
    gesamt_km: d.km,
    gesamt_km_vw: d.km_vw,
    einnahmen: d.einnahmen,
    einnahmen_vw: d.einnahmen_vw,
    bewertung: d.bew,
    bewertung_vw: d.bew_vw,
    schichtdauer_h: d.dauer,
    schichtdauer_h_vw: d.dauer_vw,
    trend_einnahmen: d.einnahmen > d.einnahmen_vw ? 'steigend' : d.einnahmen < d.einnahmen_vw ? 'fallend' : 'stabil',
    trend_delta_einnahmen: Math.round((d.einnahmen - d.einnahmen_vw) * 10) / 10,
    ampel: calcAmpel(d.einnahmen, d.bew, d.touren),
    alert_schicht: d.dauer > 10,
  })).sort((a, b) => b.einnahmen - a.einnahmen);

  const team_touren = fahrer.reduce((s, f) => s + f.touren, 0);
  const team_einnahmen = Math.round(fahrer.reduce((s, f) => s + f.einnahmen, 0) * 10) / 10;
  const alert_count = fahrer.filter(f => f.alert_schicht).length;

  if (driverId) {
    const f = fahrer.find(d => d.fahrer_id === driverId) ?? fahrer[0];
    return { fahrer_single: f, team_touren, team_einnahmen };
  }

  return { fahrer, team_touren, team_einnahmen, alert_count, generiert_am: new Date().toISOString() };
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

    async function getTouren(dId: string, date: string): Promise<number> {
      const { count } = await supabase
        .from('delivery_tours')
        .select('id', { count: 'exact', head: true })
        .eq('driver_id', dId)
        .gte('created_at', date + 'T00:00:00')
        .lte('created_at', date + 'T23:59:59')
        .in('status', ['completed', 'delivered']);
      return count ?? 0;
    }

    async function getGesamtKm(dId: string, date: string): Promise<number> {
      const { data } = await supabase
        .from('delivery_tours')
        .select('distance_km')
        .eq('driver_id', dId)
        .gte('created_at', date + 'T00:00:00')
        .lte('created_at', date + 'T23:59:59')
        .not('distance_km', 'is', null);
      return data?.reduce((s, r) => s + (r.distance_km ?? 0), 0) ?? 0;
    }

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

    async function getBewertung(dId: string, date: string): Promise<number> {
      const { data } = await supabase
        .from('delivery_tours')
        .select('rating')
        .eq('driver_id', dId)
        .gte('created_at', date + 'T00:00:00')
        .lte('created_at', date + 'T23:59:59')
        .not('rating', 'is', null);
      if (!data?.length) return 0;
      return data.reduce((s, r) => s + (r.rating ?? 0), 0) / data.length;
    }

    async function getSchichtdauer(dId: string, date: string): Promise<number> {
      const { data } = await supabase
        .from('driver_shifts')
        .select('started_at, ended_at')
        .eq('driver_id', dId)
        .gte('started_at', date + 'T00:00:00')
        .lte('started_at', date + 'T23:59:59')
        .not('started_at', 'is', null);
      if (!data?.length) return 0;
      return data.reduce((s, r) => {
        const end = r.ended_at ? new Date(r.ended_at) : new Date();
        return s + (end.getTime() - new Date(r.started_at).getTime()) / 3600000;
      }, 0);
    }

    const fahrerData = await Promise.all(
      drivers.map(async d => {
        const [touren, touren_vw, km, km_vw, einnahmen, einnahmen_vw, bew, bew_vw, dauer, dauer_vw] =
          await Promise.all([
            getTouren(d.id, today),
            getTouren(d.id, lastWeek),
            getGesamtKm(d.id, today),
            getGesamtKm(d.id, lastWeek),
            getEinnahmen(d.id, today),
            getEinnahmen(d.id, lastWeek),
            getBewertung(d.id, today),
            getBewertung(d.id, lastWeek),
            getSchichtdauer(d.id, today),
            getSchichtdauer(d.id, lastWeek),
          ]);

        return {
          fahrer_id: d.id,
          fahrer_name: d.name ?? 'Fahrer',
          touren,
          touren_vw,
          gesamt_km: Math.round(km * 10) / 10,
          gesamt_km_vw: Math.round(km_vw * 10) / 10,
          einnahmen: Math.round(einnahmen * 10) / 10,
          einnahmen_vw: Math.round(einnahmen_vw * 10) / 10,
          bewertung: Math.round(bew * 10) / 10,
          bewertung_vw: Math.round(bew_vw * 10) / 10,
          schichtdauer_h: Math.round(dauer * 10) / 10,
          schichtdauer_h_vw: Math.round(dauer_vw * 10) / 10,
          trend_einnahmen: einnahmen > einnahmen_vw ? 'steigend' : einnahmen < einnahmen_vw ? 'fallend' : 'stabil',
          trend_delta_einnahmen: Math.round((einnahmen - einnahmen_vw) * 10) / 10,
          ampel: calcAmpel(einnahmen, bew, touren),
          alert_schicht: dauer > 10,
        } satisfies FahrerSchichtBilanz;
      })
    );

    const sorted = fahrerData.sort((a, b) => b.einnahmen - a.einnahmen);
    const team_touren = sorted.reduce((s, f) => s + f.touren, 0);
    const team_einnahmen = Math.round(sorted.reduce((s, f) => s + f.einnahmen, 0) * 10) / 10;
    const alert_count = sorted.filter(f => f.alert_schicht).length;

    if (driverId) {
      const f = sorted.find(d => d.fahrer_id === driverId) ?? sorted[0];
      return NextResponse.json({ fahrer_single: f, team_touren, team_einnahmen });
    }

    return NextResponse.json({ fahrer: sorted, team_touren, team_einnahmen, alert_count, generiert_am: new Date().toISOString() });
  } catch {
    return NextResponse.json(buildMock(locationId, driverId));
  }
}
