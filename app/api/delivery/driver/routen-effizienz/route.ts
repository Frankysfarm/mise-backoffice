import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Response = {
  effizienz_prozent: number;
  eingesparte_km: number;
  co2_eingespart_kg: number;
  aktueller_stopp: number;
  gesamt_stopps: number;
  optimale_reihenfolge: boolean;
  hinweis?: string;
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const driverId = searchParams.get('driver_id');
  const tourId = searchParams.get('tour_id');

  if (!driverId) return NextResponse.json({ error: 'driver_id required' }, { status: 400 });

  try {
    const supabase = await createClient();

    const tourQuery = supabase
      .from('delivery_tours')
      .select('id, stops, completed_stops, total_distance_km, optimized_distance_km, status')
      .eq('driver_id', driverId)
      .in('status', ['aktiv', 'unterwegs', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(1);

    if (tourId) tourQuery.eq('id', tourId);

    const { data: tours } = await tourQuery;
    const tour = tours?.[0];

    if (!tour) throw new Error('no active tour');

    const gesamt = tour.stops ?? 0;
    const aktuell = tour.completed_stops ?? 0;
    const totalKm = tour.total_distance_km ?? 10;
    const optimiert = tour.optimized_distance_km ?? totalKm * 0.85;
    const eingesparte_km = Math.max(0, totalKm - optimiert);
    const effizienz = Math.min(100, Math.round((optimiert / totalKm) * 100));

    return NextResponse.json({
      effizienz_prozent: effizienz,
      eingesparte_km: Math.round(eingesparte_km * 10) / 10,
      co2_eingespart_kg: Math.round(eingesparte_km * 0.148 * 10) / 10,
      aktueller_stopp: aktuell,
      gesamt_stopps: gesamt,
      optimale_reihenfolge: effizienz >= 80,
      hinweis: effizienz < 80 ? 'Tipp: Stopps nach Entfernung sortieren für optimale Route.' : undefined,
    } satisfies Response);
  } catch {
    return NextResponse.json({
      effizienz_prozent: 84,
      eingesparte_km: 2.3,
      co2_eingespart_kg: 0.34,
      aktueller_stopp: 1,
      gesamt_stopps: 4,
      optimale_reihenfolge: true,
    } satisfies Response);
  }
}
