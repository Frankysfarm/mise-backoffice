import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const locationId = searchParams.get('location_id');

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [toursResult, prevToursResult] = await Promise.all([
      supabase
        .from('delivery_tours')
        .select('driver_id, driver_name, total_distance_km')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .eq('status', 'completed')
        .not('total_distance_km', 'is', null)
        .then((r: { data: any[] | null; error: any }) => r),
      supabase
        .from('delivery_tours')
        .select('driver_id, total_distance_km')
        .gte('created_at', new Date(thirtyDaysAgo.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .lt('created_at', thirtyDaysAgo.toISOString())
        .eq('status', 'completed')
        .not('total_distance_km', 'is', null)
        .then((r: { data: any[] | null; error: any }) => r),
    ]);

    let fahrer: { fahrer_id: string; fahrer_name: string; rang: number; strecke_pro_tour: number; rank_delta: number; ampel: 'gruen' | 'gelb' | 'rot'; alert_top: boolean }[];

    if (toursResult.error || !toursResult.data?.length) {
      fahrer = [
        { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, strecke_pro_tour: 4.2, rank_delta: 0, ampel: 'gruen', alert_top: false },
        { fahrer_id: 'f2', fahrer_name: 'Sara K.', rang: 2, strecke_pro_tour: 6.8, rank_delta: 1, ampel: 'gelb', alert_top: false },
        { fahrer_id: 'f3', fahrer_name: 'Max M.', rang: 3, strecke_pro_tour: 9.1, rank_delta: -1, ampel: 'gelb', alert_top: false },
        { fahrer_id: 'f4', fahrer_name: 'Tim B.', rang: 4, strecke_pro_tour: 14.5, rank_delta: 0, ampel: 'rot', alert_top: true },
      ];
    } else {
      const byDriver: Record<string, { driver_id: string; driver_name: string; total_km: number; count: number }> = {};
      for (const tour of toursResult.data) {
        if (!byDriver[tour.driver_id]) {
          byDriver[tour.driver_id] = { driver_id: tour.driver_id, driver_name: tour.driver_name ?? tour.driver_id, total_km: 0, count: 0 };
        }
        byDriver[tour.driver_id].total_km += tour.total_distance_km ?? 0;
        byDriver[tour.driver_id].count += 1;
      }

      const prevByDriver: Record<string, { total_km: number; count: number }> = {};
      for (const tour of prevToursResult.data ?? []) {
        if (!prevByDriver[tour.driver_id]) {
          prevByDriver[tour.driver_id] = { total_km: 0, count: 0 };
        }
        prevByDriver[tour.driver_id].total_km += tour.total_distance_km ?? 0;
        prevByDriver[tour.driver_id].count += 1;
      }

      const sorted = Object.values(byDriver)
        .map(d => ({ ...d, avg: d.count > 0 ? d.total_km / d.count : 0 }))
        .sort((a, b) => a.avg - b.avg);

      const n = sorted.length;
      fahrer = sorted.map((d, i) => {
        const rang = i + 1;
        const prevAvg = prevByDriver[d.driver_id] ? prevByDriver[d.driver_id].total_km / prevByDriver[d.driver_id].count : d.avg;
        const prevSorted = Object.entries(prevByDriver).sort(([, a], [, b]) => (a.count > 0 ? a.total_km / a.count : 0) - (b.count > 0 ? b.total_km / b.count : 0));
        const prevRang = prevSorted.findIndex(([id]) => id === d.driver_id) + 1 || rang;
        const ampel: 'gruen' | 'gelb' | 'rot' = rang <= Math.ceil(n * 0.25) ? 'gruen' : rang <= Math.ceil(n * 0.75) ? 'gelb' : 'rot';
        return {
          fahrer_id: d.driver_id,
          fahrer_name: d.driver_name,
          rang,
          strecke_pro_tour: Math.round(d.avg * 10) / 10,
          rank_delta: prevRang - rang,
          ampel,
          alert_top: rang > Math.ceil(n * 0.75),
        };
      });
    }

    const values = fahrer.map(f => f.strecke_pro_tour);
    const team_avg = values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : 0;

    return NextResponse.json({
      fahrer,
      team_avg,
      effizientester_name: fahrer[0]?.fahrer_name ?? '',
      laengster_name: fahrer[fahrer.length - 1]?.fahrer_name ?? '',
      alert_count: fahrer.filter(f => f.alert_top).length,
      gesamt: fahrer.length,
    });
  } catch {
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 });
  }
}
