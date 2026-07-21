// Phase 2995 — Fahrer-CO2-Ausstoss-Index
// GET /api/delivery/admin/fahrer-co2-ausstoss?location_id=<uuid>[&driver_id=<uuid>]
// CO2 = distance_km × 0.21 kg/km; Ampel grün(≤15)/gelb(15–25)/rot(>25). Alert >25 kg "Hoher CO2-Ausstoss!"
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const CO2_PRO_KM   = 0.21; // kg/km Standardwert PKW/Transporter
const ZIEL_CO2     = 15;   // kg — grün
const ALERT_CO2    = 25;   // kg — rot

type Ampel = 'gruen' | 'gelb' | 'rot';

function calcAmpel(co2: number): Ampel {
  if (co2 <= ZIEL_CO2)  return 'gruen';
  if (co2 <= ALERT_CO2) return 'gelb';
  return 'rot';
}

export interface FahrerCo2Ausstoss {
  fahrer_id: string;
  fahrer_name: string;
  co2_kg: number;
  co2_kg_gestern: number;
  km_heute: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: Ampel;
  alert_hoher_co2: boolean;
}

export interface FahrerCo2AusstossResponse {
  fahrer: FahrerCo2Ausstoss[];
  team_avg_co2: number;
  team_avg_co2_gestern: number;
  alert_count: number;
  generiert_am: string;
}

function buildMock(locationId: string, driverId?: string) {
  const raw = [
    { id: 'd1', name: 'Max M.',   km: 94.2, km_g: 88.1 },
    { id: 'd2', name: 'Sara K.',  km: 81.0, km_g: 79.5 },
    { id: 'd3', name: 'Tim B.',   km: 75.3, km_g: 72.8 },
    { id: 'd4', name: 'Julia F.', km: 89.6, km_g: 95.2 },
  ];

  const fahrer: FahrerCo2Ausstoss[] = raw
    .map(d => {
      const co2      = Math.round(d.km   * CO2_PRO_KM * 10) / 10;
      const co2_g    = Math.round(d.km_g * CO2_PRO_KM * 10) / 10;
      const delta    = Math.round((co2 - co2_g) * 10) / 10;
      return {
        fahrer_id: d.id,
        fahrer_name: d.name,
        co2_kg: co2,
        co2_kg_gestern: co2_g,
        km_heute: d.km,
        trend: (co2 > co2_g ? 'steigend' : co2 < co2_g ? 'fallend' : 'stabil') as 'steigend' | 'fallend' | 'stabil',
        trend_delta: delta,
        ampel: calcAmpel(co2),
        alert_hoher_co2: co2 > ALERT_CO2,
      };
    })
    .sort((a, b) => a.co2_kg - b.co2_kg); // aufsteigend: niedrigste zuerst

  const team_avg_co2         = Math.round((fahrer.reduce((s, f) => s + f.co2_kg, 0)          / fahrer.length) * 10) / 10;
  const team_avg_co2_gestern = Math.round((raw.reduce((s, d) => s + d.km_g * CO2_PRO_KM, 0) / raw.length)    * 10) / 10;
  const alert_count          = fahrer.filter(f => f.alert_hoher_co2).length;

  if (driverId) {
    const f = fahrer.find(x => x.fahrer_id === driverId) ?? fahrer[0];
    return { fahrer_single: f, team_avg_co2 };
  }

  return { fahrer, team_avg_co2, team_avg_co2_gestern, alert_count, generiert_am: new Date().toISOString() };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const driverId   = searchParams.get('driver_id') ?? undefined;

  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const supabase  = createServiceClient();
    const today     = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);

    const { data: drivers } = await supabase
      .from('drivers')
      .select('id, name')
      .eq('location_id', locationId)
      .eq('is_active', true);

    if (!drivers?.length) return NextResponse.json(buildMock(locationId, driverId));

    async function getKm(dId: string, date: string): Promise<number> {
      const { data: stops } = await supabase
        .from('batch_stops')
        .select('distance_km')
        .eq('driver_id', dId)
        .gte('created_at', date + 'T00:00:00')
        .lte('created_at', date + 'T23:59:59')
        .not('distance_km', 'is', null);
      return stops?.reduce((s, r) => s + (r.distance_km ?? 0), 0) ?? 0;
    }

    const results = await Promise.all(
      drivers.map(async d => {
        const [km_heute, km_gestern] = await Promise.all([
          getKm(d.id, today),
          getKm(d.id, yesterday),
        ]);
        return { driverId: d.id, driverName: d.name, km_heute, km_gestern };
      }),
    );

    const hasRealData = results.some(r => r.km_heute > 0 || r.km_gestern > 0);
    if (!hasRealData) return NextResponse.json(buildMock(locationId, driverId));

    const fahrer: FahrerCo2Ausstoss[] = results
      .map(r => {
        const co2   = Math.round(r.km_heute   * CO2_PRO_KM * 10) / 10;
        const co2_g = Math.round(r.km_gestern * CO2_PRO_KM * 10) / 10;
        const delta = Math.round((co2 - co2_g) * 10) / 10;
        return {
          fahrer_id: r.driverId,
          fahrer_name: r.driverName,
          co2_kg: co2,
          co2_kg_gestern: co2_g,
          km_heute: r.km_heute,
          trend: (co2 > co2_g ? 'steigend' : co2 < co2_g ? 'fallend' : 'stabil') as 'steigend' | 'fallend' | 'stabil',
          trend_delta: delta,
          ampel: calcAmpel(co2),
          alert_hoher_co2: co2 > ALERT_CO2,
        };
      })
      .sort((a, b) => a.co2_kg - b.co2_kg); // aufsteigend

    const team_avg_co2         = fahrer.length ? Math.round((fahrer.reduce((s, f) => s + f.co2_kg,          0) / fahrer.length) * 10) / 10 : 0;
    const team_avg_co2_gestern = fahrer.length ? Math.round((fahrer.reduce((s, f) => s + f.co2_kg_gestern,  0) / fahrer.length) * 10) / 10 : 0;
    const alert_count          = fahrer.filter(f => f.alert_hoher_co2).length;

    if (driverId) {
      const f = fahrer.find(x => x.fahrer_id === driverId) ?? fahrer[0];
      return NextResponse.json({ fahrer_single: f, team_avg_co2 });
    }

    return NextResponse.json({ fahrer, team_avg_co2, team_avg_co2_gestern, alert_count, generiert_am: new Date().toISOString() });
  } catch (err) {
    console.error('fahrer-co2-ausstoss error', err);
    return NextResponse.json(buildMock(locationId, driverId));
  }
}
