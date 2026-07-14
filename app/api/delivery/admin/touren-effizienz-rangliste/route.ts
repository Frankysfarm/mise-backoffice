/**
 * GET /api/delivery/admin/touren-effizienz-rangliste?location_id=<uuid>
 *
 * Phase 1572 — Touren-Effizienz-Rangliste-API
 * Je Fahrer letzte 7 Tage: Stopps/Tour, Ø km/Stopp, Pünktlichkeitsrate, Rang.
 * Status: top (Rang 1–3) | normal | schwach (letztes Drittel).
 * Supabase + Mock-Fallback.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface TourenEfzienzEintrag {
  fahrer_id: string;
  fahrer_name: string;
  touren_anzahl: number;
  stopps_pro_tour: number;
  km_pro_stopp: number;
  puenktlichkeitsrate: number;
  rang: number;
  status: 'top' | 'normal' | 'schwach';
}

export interface TourenEffizienzRanglisteResponse {
  fahrer: TourenEfzienzEintrag[];
  zeitraum_tage: number;
  location_id: string;
  generated_at: string;
}

const MOCK_DATA: TourenEfzienzEintrag[] = [
  { fahrer_id: 'f1', fahrer_name: 'Max Müller', touren_anzahl: 28, stopps_pro_tour: 4.2, km_pro_stopp: 1.8, puenktlichkeitsrate: 94, rang: 1, status: 'top' },
  { fahrer_id: 'f2', fahrer_name: 'Anna Schmidt', touren_anzahl: 25, stopps_pro_tour: 3.9, km_pro_stopp: 2.1, puenktlichkeitsrate: 91, rang: 2, status: 'top' },
  { fahrer_id: 'f3', fahrer_name: 'Lars Weber', touren_anzahl: 22, stopps_pro_tour: 3.5, km_pro_stopp: 2.4, puenktlichkeitsrate: 87, rang: 3, status: 'top' },
  { fahrer_id: 'f4', fahrer_name: 'Jana Klein', touren_anzahl: 19, stopps_pro_tour: 3.2, km_pro_stopp: 2.7, puenktlichkeitsrate: 83, rang: 4, status: 'normal' },
  { fahrer_id: 'f5', fahrer_name: 'Tom Fischer', touren_anzahl: 15, stopps_pro_tour: 2.8, km_pro_stopp: 3.2, puenktlichkeitsrate: 74, rang: 5, status: 'schwach' },
];

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const locationId = url.searchParams.get('location_id');

  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const sb = await createClient();
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const { data: touren, error } = await sb
      .from('delivery_tours')
      .select('driver_id, stops_count, distance_km, completed_at, scheduled_at')
      .eq('location_id', locationId)
      .gte('created_at', since.toISOString())
      .eq('status', 'completed');

    if (error || !touren || touren.length === 0) {
      return NextResponse.json({
        fahrer: MOCK_DATA,
        zeitraum_tage: 7,
        location_id: locationId,
        generated_at: new Date().toISOString(),
      });
    }

    // Aggregate per driver
    const driverMap: Record<string, { stopps: number[]; km: number[]; puenktlich: number; gesamt: number }> = {};
    for (const tour of touren) {
      const id = tour.driver_id as string;
      if (!id) continue;
      if (!driverMap[id]) driverMap[id] = { stopps: [], km: [], puenktlich: 0, gesamt: 0 };
      driverMap[id].stopps.push((tour.stops_count as number) ?? 0);
      driverMap[id].km.push((tour.distance_km as number) ?? 0);
      driverMap[id].gesamt++;
      if (tour.completed_at && tour.scheduled_at) {
        const diff = new Date(tour.completed_at as string).getTime() - new Date(tour.scheduled_at as string).getTime();
        if (diff <= 10 * 60 * 1000) driverMap[id].puenktlich++;
      }
    }

    const entries = Object.entries(driverMap).map(([id, d]) => {
      const avg_stopps = d.stopps.reduce((a, b) => a + b, 0) / Math.max(d.stopps.length, 1);
      const total_km = d.km.reduce((a, b) => a + b, 0);
      const total_stopps = d.stopps.reduce((a, b) => a + b, 0);
      return {
        fahrer_id: id,
        fahrer_name: id,
        touren_anzahl: d.gesamt,
        stopps_pro_tour: Math.round(avg_stopps * 10) / 10,
        km_pro_stopp: total_stopps > 0 ? Math.round((total_km / total_stopps) * 10) / 10 : 0,
        puenktlichkeitsrate: Math.round((d.puenktlich / d.gesamt) * 100),
      };
    });

    entries.sort((a, b) => b.puenktlichkeitsrate - a.puenktlichkeitsrate);

    const third = Math.ceil(entries.length / 3);
    const fahrer: TourenEfzienzEintrag[] = entries.map((e, i) => ({
      ...e,
      rang: i + 1,
      status: i < 3 ? 'top' : i >= entries.length - third ? 'schwach' : 'normal',
    }));

    return NextResponse.json({
      fahrer,
      zeitraum_tage: 7,
      location_id: locationId,
      generated_at: new Date().toISOString(),
    } satisfies TourenEffizienzRanglisteResponse);
  } catch {
    return NextResponse.json({
      fahrer: MOCK_DATA,
      zeitraum_tage: 7,
      location_id: locationId,
      generated_at: new Date().toISOString(),
    });
  }
}
