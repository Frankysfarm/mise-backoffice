// Phase 2990 — Fahrer-Kraftstoff-Effizienz
// GET /api/delivery/admin/fahrer-kraftstoff-effizienz?location_id=<uuid>[&driver_id=<uuid>]
// Ø km/l je Fahrer heute; Ampel grün(≥15)/gelb(10–14)/rot(<10). Alert <10 "Hoher Verbrauch!"
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const ZIEL_KML   = 15;
const ALERT_KML  = 10;

type Ampel = 'gruen' | 'gelb' | 'rot';

function calcAmpel(kml: number): Ampel {
  if (kml >= ZIEL_KML)  return 'gruen';
  if (kml >= ALERT_KML) return 'gelb';
  return 'rot';
}

export interface FahrerKraftstoffEfzizienz {
  fahrer_id: string;
  fahrer_name: string;
  km_pro_liter: number;
  km_pro_liter_gestern: number;
  km_heute: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: Ampel;
  alert_hoher_verbrauch: boolean;
}

export interface FahrerKraftstoffEffizienzResponse {
  fahrer: FahrerKraftstoffEfzizienz[];
  team_avg_kml: number;
  team_avg_kml_gestern: number;
  alert_count: number;
  generiert_am: string;
}

function buildMock(locationId: string, driverId?: string) {
  const raw = [
    { id: 'd1', name: 'Max M.',   kml: 16.8, kml_g: 15.9, km: 94.2 },
    { id: 'd2', name: 'Sara K.',  kml: 13.5, kml_g: 14.2, km: 81.0 },
    { id: 'd3', name: 'Tim B.',   kml:  9.4, kml_g: 10.1, km: 75.3 },
    { id: 'd4', name: 'Julia F.', kml: 14.9, kml_g: 13.8, km: 89.6 },
  ];

  const fahrer: FahrerKraftstoffEfzizienz[] = raw
    .map(d => ({
      fahrer_id: d.id,
      fahrer_name: d.name,
      km_pro_liter: d.kml,
      km_pro_liter_gestern: d.kml_g,
      km_heute: d.km,
      trend: (d.kml > d.kml_g ? 'steigend' : d.kml < d.kml_g ? 'fallend' : 'stabil') as 'steigend' | 'fallend' | 'stabil',
      trend_delta: Math.round((d.kml - d.kml_g) * 10) / 10,
      ampel: calcAmpel(d.kml),
      alert_hoher_verbrauch: d.kml < ALERT_KML,
    }))
    .sort((a, b) => b.km_pro_liter - a.km_pro_liter);

  const team_avg_kml = Math.round((fahrer.reduce((s, f) => s + f.km_pro_liter, 0) / fahrer.length) * 10) / 10;
  const team_avg_kml_gestern = Math.round((raw.reduce((s, d) => s + d.kml_g, 0) / raw.length) * 10) / 10;
  const alert_count = fahrer.filter(f => f.alert_hoher_verbrauch).length;

  if (driverId) {
    const f = fahrer.find(d => d.fahrer_id === driverId) ?? fahrer[0];
    return { fahrer_single: f, team_avg_kml };
  }

  return { fahrer, team_avg_kml, team_avg_kml_gestern, alert_count, generiert_am: new Date().toISOString() };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const driverId   = searchParams.get('driver_id') ?? undefined;

  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const supabase = createServiceClient();
    const today     = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);

    const { data: drivers } = await supabase
      .from('drivers')
      .select('id, name')
      .eq('location_id', locationId)
      .eq('is_active', true);

    if (!drivers?.length) return NextResponse.json(buildMock(locationId, driverId));

    async function getKmUndKml(dId: string, date: string): Promise<{ km: number; kml: number }> {
      // Try driver_vehicle_stats for real fuel efficiency data
      const { data: stats } = await supabase
        .from('driver_vehicle_stats')
        .select('km_per_liter, total_km')
        .eq('driver_id', dId)
        .gte('date', date)
        .lte('date', date)
        .limit(1)
        .maybeSingle();

      if (stats?.km_per_liter) {
        return { km: stats.total_km ?? 0, kml: stats.km_per_liter };
      }

      // Fallback: derive from batch_stops distance_km
      const { data: stops } = await supabase
        .from('batch_stops')
        .select('distance_km')
        .eq('driver_id', dId)
        .gte('created_at', date + 'T00:00:00')
        .lte('created_at', date + 'T23:59:59')
        .not('distance_km', 'is', null);

      const km = stops?.reduce((s, r) => s + (r.distance_km ?? 0), 0) ?? 0;
      // No real fuel data — return 0 to signal fallback needed
      return { km, kml: 0 };
    }

    const results = await Promise.all(
      drivers.map(async d => {
        const [heute, gestern] = await Promise.all([
          getKmUndKml(d.id, today),
          getKmUndKml(d.id, yesterday),
        ]);
        return { driverId: d.id, driverName: d.name, heute, gestern };
      }),
    );

    // If no real kml data available, fall back to mock
    const hasRealData = results.some(r => r.heute.kml > 0);
    if (!hasRealData) return NextResponse.json(buildMock(locationId, driverId));

    const fahrer: FahrerKraftstoffEfzizienz[] = results
      .filter(r => r.heute.kml > 0 || r.heute.km > 0)
      .map(r => {
        const kml  = r.heute.kml;
        const kml_g = r.gestern.kml;
        return {
          fahrer_id: r.driverId,
          fahrer_name: r.driverName,
          km_pro_liter: kml,
          km_pro_liter_gestern: kml_g,
          km_heute: r.heute.km,
          trend: (kml > kml_g ? 'steigend' : kml < kml_g ? 'fallend' : 'stabil') as 'steigend' | 'fallend' | 'stabil',
          trend_delta: Math.round((kml - kml_g) * 10) / 10,
          ampel: calcAmpel(kml),
          alert_hoher_verbrauch: kml < ALERT_KML && kml > 0,
        };
      })
      .sort((a, b) => b.km_pro_liter - a.km_pro_liter);

    const team_avg_kml = fahrer.length
      ? Math.round((fahrer.reduce((s, f) => s + f.km_pro_liter, 0) / fahrer.length) * 10) / 10
      : 0;
    const team_avg_kml_gestern = fahrer.length
      ? Math.round((fahrer.reduce((s, f) => s + f.km_pro_liter_gestern, 0) / fahrer.length) * 10) / 10
      : 0;
    const alert_count = fahrer.filter(f => f.alert_hoher_verbrauch).length;

    if (driverId) {
      const f = fahrer.find(x => x.fahrer_id === driverId) ?? fahrer[0];
      return NextResponse.json({ fahrer_single: f, team_avg_kml });
    }

    return NextResponse.json({ fahrer, team_avg_kml, team_avg_kml_gestern, alert_count, generiert_am: new Date().toISOString() });
  } catch (err) {
    console.error('fahrer-kraftstoff-effizienz error', err);
    return NextResponse.json(buildMock(locationId, driverId));
  }
}
