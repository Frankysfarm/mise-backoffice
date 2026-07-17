import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface FahrerRoutenEffizienz {
  driver_id: string;
  name: string;
  km_gesamt: number;
  touren_count: number;
  avg_km_pro_bestellung: number;
  effizienz_score: number;
  alert: boolean;
}

export interface FahrerRoutenEffizienzResponse {
  location_id: string;
  fahrer: FahrerRoutenEffizienz[];
  team_avg_km: number;
  alert_count: number;
  generiert_am: string;
}

const KM_ALERT_THRESHOLD = 8;

const MOCK: FahrerRoutenEffizienzResponse = {
  location_id: 'mock',
  fahrer: [
    { driver_id: 'd1', name: 'Max M.', km_gesamt: 42, touren_count: 7, avg_km_pro_bestellung: 6.0, effizienz_score: 82, alert: false },
    { driver_id: 'd2', name: 'Sarah K.', km_gesamt: 31, touren_count: 8, avg_km_pro_bestellung: 3.9, effizienz_score: 91, alert: false },
    { driver_id: 'd3', name: 'Tom B.', km_gesamt: 67, touren_count: 5, avg_km_pro_bestellung: 13.4, effizienz_score: 54, alert: true },
    { driver_id: 'd4', name: 'Anna L.', km_gesamt: 38, touren_count: 6, avg_km_pro_bestellung: 6.3, effizienz_score: 79, alert: false },
  ],
  team_avg_km: 7.4,
  alert_count: 1,
  generiert_am: new Date().toISOString(),
};

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id')?.trim();
  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const sb = await createClient();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: drivers } = await sb
      .from('drivers')
      .select('id, vorname, nachname')
      .eq('location_id', locationId);

    const { data: batches } = await sb
      .from('delivery_batches')
      .select('id, driver_id, distance_km, stop_count, delivered_at')
      .eq('location_id', locationId)
      .gte('delivered_at', todayStart.toISOString())
      .not('delivered_at', 'is', null);

    if (!drivers || !batches || drivers.length === 0) return NextResponse.json(MOCK);

    const fahrerList: FahrerRoutenEffizienz[] = [];

    for (const d of drivers) {
      const myBatches = batches.filter(b => b.driver_id === d.id);
      if (myBatches.length === 0) continue;

      const kmGesamt = Math.round(myBatches.reduce((s, b) => s + (b.distance_km ?? 0), 0) * 10) / 10;
      const tourenCount = myBatches.length;
      const totalStops = myBatches.reduce((s, b) => s + (b.stop_count ?? 1), 0);
      const avgKm = totalStops > 0
        ? Math.round((kmGesamt / totalStops) * 10) / 10
        : kmGesamt;

      const maxEfficientKm = 5;
      const effizienzScore = Math.max(0, Math.min(100, Math.round(100 - (avgKm - maxEfficientKm) * 5)));

      fahrerList.push({
        driver_id: d.id,
        name: `${d.vorname ?? ''} ${d.nachname ?? ''}`.trim() || 'Fahrer',
        km_gesamt: kmGesamt,
        touren_count: tourenCount,
        avg_km_pro_bestellung: avgKm,
        effizienz_score: effizienzScore,
        alert: avgKm > KM_ALERT_THRESHOLD,
      });
    }

    if (fahrerList.length === 0) return NextResponse.json(MOCK);

    fahrerList.sort((a, b) => a.avg_km_pro_bestellung - b.avg_km_pro_bestellung);

    const teamAvg = Math.round(
      (fahrerList.reduce((s, f) => s + f.avg_km_pro_bestellung, 0) / fahrerList.length) * 10,
    ) / 10;

    return NextResponse.json({
      location_id: locationId,
      fahrer: fahrerList,
      team_avg_km: teamAvg,
      alert_count: fahrerList.filter(f => f.alert).length,
      generiert_am: new Date().toISOString(),
    } satisfies FahrerRoutenEffizienzResponse);
  } catch {
    return NextResponse.json(MOCK);
  }
}
