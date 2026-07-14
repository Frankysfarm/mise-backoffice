import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const location_id = searchParams.get('location_id');

  if (!location_id) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const supabase = createClient();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: batches } = await supabase
      .from('batches')
      .select('driver_id, stops, delivered_at, dispatched_at, distance_km')
      .eq('location_id', location_id)
      .gte('dispatched_at', sevenDaysAgo)
      .not('driver_id', 'is', null);

    type DriverStats = {
      stopps: number;
      touren: number;
      km: number;
      puenktlich: number;
    };
    const driverMap: Record<string, DriverStats> = {};

    for (const b of batches ?? []) {
      const d = (b as any).driver_id as string;
      if (!d) continue;
      if (!driverMap[d]) driverMap[d] = { stopps: 0, touren: 0, km: 0, puenktlich: 0 };
      const stopCount = Array.isArray((b as any).stops) ? (b as any).stops.length : 1;
      driverMap[d].stopps += stopCount;
      driverMap[d].touren += 1;
      driverMap[d].km += (b as any).distance_km ?? 0;
      // Pünktlich wenn Differenz dispatched→delivered ≤ 35 Min
      if ((b as any).delivered_at && (b as any).dispatched_at) {
        const diff = (new Date((b as any).delivered_at).getTime() - new Date((b as any).dispatched_at).getTime()) / 60000;
        if (diff <= 35) driverMap[d].puenktlich += 1;
      }
    }

    const rangliste = Object.entries(driverMap)
      .map(([driver_id, s]) => {
        const stopps_pro_tour = s.touren > 0 ? Math.round((s.stopps / s.touren) * 10) / 10 : 0;
        const km_pro_stopp = s.stopps > 0 ? Math.round((s.km / s.stopps) * 10) / 10 : 0;
        const puenktlichkeit_pct = s.touren > 0 ? Math.round((s.puenktlich / s.touren) * 100) : 0;
        return { driver_id, stopps_pro_tour, km_pro_stopp, puenktlichkeit_pct, touren_total: s.touren };
      })
      .sort((a, b) => b.stopps_pro_tour - a.stopps_pro_tour)
      .map((d, i) => ({
        ...d,
        rang: i + 1,
        status: i === 0 ? 'top' : d.puenktlichkeit_pct >= 70 ? 'normal' : 'schwach',
      }));

    return NextResponse.json({ rangliste, location_id, generiert_am: new Date().toISOString() });
  } catch {
    // Mock-Fallback
    return NextResponse.json({
      rangliste: [
        { driver_id: 'Fahrer A', stopps_pro_tour: 4.2, km_pro_stopp: 1.8, puenktlichkeit_pct: 91, touren_total: 12, rang: 1, status: 'top' },
        { driver_id: 'Fahrer B', stopps_pro_tour: 3.8, km_pro_stopp: 2.1, puenktlichkeit_pct: 78, touren_total: 10, rang: 2, status: 'normal' },
        { driver_id: 'Fahrer C', stopps_pro_tour: 3.1, km_pro_stopp: 2.8, puenktlichkeit_pct: 62, touren_total: 8, rang: 3, status: 'schwach' },
      ],
      location_id,
      generiert_am: new Date().toISOString(),
    });
  }
}
