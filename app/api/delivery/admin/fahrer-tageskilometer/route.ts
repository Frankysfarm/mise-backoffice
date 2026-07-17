import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface FahrerTagesKm {
  driver_id: string;
  name: string;
  km_heute: number;
  km_ziel: number;
  zielerreichung_pct: number;
  km_7tage_avg: number;
  trend: 'up' | 'down' | 'gleich';
  trend_delta_km: number;
}

export interface FahrerTagesKilometerResponse {
  location_id: string;
  fahrer: FahrerTagesKm[];
  team_km_gesamt: number;
  team_km_ziel_gesamt: number;
  team_zielerreichung_pct: number;
  alert_count: number;
  generiert_am: string;
}

const ZIEL_KM_PRO_SCHICHT = 80;

const MOCK: FahrerTagesKilometerResponse = {
  location_id: 'mock',
  fahrer: [
    { driver_id: 'd1', name: 'Max M.',   km_heute: 72, km_ziel: 80, zielerreichung_pct: 90,  km_7tage_avg: 65, trend: 'up',    trend_delta_km:  7 },
    { driver_id: 'd2', name: 'Sarah K.', km_heute: 38, km_ziel: 80, zielerreichung_pct: 48,  km_7tage_avg: 70, trend: 'down',  trend_delta_km: -32 },
    { driver_id: 'd3', name: 'Tom B.',   km_heute: 99, km_ziel: 80, zielerreichung_pct: 124, km_7tage_avg: 80, trend: 'up',    trend_delta_km: 19 },
    { driver_id: 'd4', name: 'Anna L.',  km_heute: 55, km_ziel: 80, zielerreichung_pct: 69,  km_7tage_avg: 58, trend: 'gleich', trend_delta_km: -3 },
  ],
  team_km_gesamt: 264,
  team_km_ziel_gesamt: 320,
  team_zielerreichung_pct: 83,
  alert_count: 2,
  generiert_am: new Date().toISOString(),
};

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id')?.trim();
  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const sb = await createClient();

    const now = new Date();
    const heuteStart = new Date(now);
    heuteStart.setUTCHours(5, 0, 0, 0);
    if (now.getUTCHours() < 5) heuteStart.setUTCDate(heuteStart.getUTCDate() - 1);

    const vor7Tage = new Date(heuteStart);
    vor7Tage.setUTCDate(vor7Tage.getUTCDate() - 7);

    const [{ data: drivers }, { data: heuteBatches }, { data: histBatches }] = await Promise.all([
      sb.from('drivers').select('id, vorname, nachname').eq('location_id', locationId),
      sb.from('delivery_batches')
        .select('driver_id, distance_km')
        .eq('location_id', locationId)
        .eq('status', 'completed')
        .gte('completed_at', heuteStart.toISOString()),
      sb.from('delivery_batches')
        .select('driver_id, distance_km')
        .eq('location_id', locationId)
        .eq('status', 'completed')
        .gte('completed_at', vor7Tage.toISOString())
        .lt('completed_at', heuteStart.toISOString()),
    ]);

    if (!drivers || !heuteBatches) return NextResponse.json({ ...MOCK, location_id: locationId });

    const heuteMap = new Map<string, number>();
    for (const b of heuteBatches) {
      heuteMap.set(b.driver_id, (heuteMap.get(b.driver_id) ?? 0) + (b.distance_km ?? 0));
    }

    const histMap = new Map<string, number[]>();
    for (const b of histBatches ?? []) {
      const arr = histMap.get(b.driver_id) ?? [];
      arr.push(b.distance_km ?? 0);
      histMap.set(b.driver_id, arr);
    }

    const fahrer: FahrerTagesKm[] = [];
    for (const d of drivers) {
      const kmHeute = Math.round((heuteMap.get(d.id) ?? 0) * 10) / 10;
      if (kmHeute === 0) continue;

      const hist = histMap.get(d.id) ?? [];
      const km7Avg = hist.length > 0
        ? Math.round((hist.reduce((s, v) => s + v, 0) / hist.length) * 10) / 10
        : 0;

      const delta = Math.round((kmHeute - km7Avg) * 10) / 10;
      const trend: 'up' | 'down' | 'gleich' = delta > 2 ? 'up' : delta < -2 ? 'down' : 'gleich';
      const zielPct = Math.round((kmHeute / ZIEL_KM_PRO_SCHICHT) * 100);

      fahrer.push({
        driver_id: d.id,
        name: `${d.vorname} ${d.nachname}`,
        km_heute: kmHeute,
        km_ziel: ZIEL_KM_PRO_SCHICHT,
        zielerreichung_pct: zielPct,
        km_7tage_avg: km7Avg,
        trend,
        trend_delta_km: delta,
      });
    }

    fahrer.sort((a, b) => b.km_heute - a.km_heute);

    const teamKm = Math.round(fahrer.reduce((s, f) => s + f.km_heute, 0) * 10) / 10;
    const teamZiel = fahrer.length * ZIEL_KM_PRO_SCHICHT;
    const teamPct = teamZiel > 0 ? Math.round((teamKm / teamZiel) * 100) : 0;
    const alertCount = fahrer.filter(f => f.zielerreichung_pct < 50).length;

    return NextResponse.json({
      location_id: locationId,
      fahrer,
      team_km_gesamt: teamKm,
      team_km_ziel_gesamt: teamZiel,
      team_zielerreichung_pct: teamPct,
      alert_count: alertCount,
      generiert_am: now.toISOString(),
    } satisfies FahrerTagesKilometerResponse);
  } catch {
    return NextResponse.json({ ...MOCK, location_id: locationId });
  }
}
