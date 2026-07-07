import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const locationId = searchParams.get('location_id');

    const supabase = await createClient();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Stündliche KPIs aus heutigen Touren berechnen
    const [{ data: batches }, { data: stops }] = await Promise.all([
      supabase
        .from('delivery_batches')
        .select('id, fahrer_id, started_at, total_eta_min, total_distance_km, status')
        .gte('created_at', today.toISOString())
        .in('status', ['abgeschlossen', 'geliefert', 'fertig']),
      supabase
        .from('delivery_batch_stops')
        .select('id, batch_id, angekommen_am, geliefert_am, order_id')
        .gte('created_at', today.toISOString())
        .not('geliefert_am', 'is', null),
    ]);

    const batchList = (batches ?? []) as any[];
    const stopList = (stops ?? []) as any[];

    // Stündliche Aggregation
    const hourlyMap: Record<number, { kmSum: number; minSum: number; count: number; stopsCount: number }> = {};

    for (const b of batchList) {
      if (!b.started_at) continue;
      const h = new Date(b.started_at).getHours();
      if (!hourlyMap[h]) hourlyMap[h] = { kmSum: 0, minSum: 0, count: 0, stopsCount: 0 };
      hourlyMap[h].kmSum += b.total_distance_km ?? 0;
      hourlyMap[h].minSum += b.total_eta_min ?? 0;
      hourlyMap[h].count += 1;
      hourlyMap[h].stopsCount += stopList.filter((s) => s.batch_id === b.id).length;
    }

    const nowH = new Date().getHours();
    const hours = [];
    for (let h = 10; h <= Math.max(nowH, 22); h++) {
      const entry = hourlyMap[h];
      hours.push({
        hour: h,
        label: `${h}:00`,
        touren: entry?.count ?? 0,
        avgKmPerLieferung: entry && entry.stopsCount > 0
          ? Math.round((entry.kmSum / entry.stopsCount) * 10) / 10
          : null,
        avgMinPerStop: entry && entry.stopsCount > 0
          ? Math.round(entry.minSum / entry.stopsCount)
          : null,
        lieferungen: entry?.stopsCount ?? 0,
      });
    }

    // Tages-Gesamtaggregat
    const totalKm = batchList.reduce((s, b) => s + (b.total_distance_km ?? 0), 0);
    const totalStops = stopList.length;
    const avgKmPerLieferung = totalStops > 0 ? Math.round((totalKm / totalStops) * 10) / 10 : null;
    const totalTouren = batchList.length;

    return NextResponse.json({
      ok: true,
      hours,
      summary: {
        totalTouren,
        totalLieferungen: totalStops,
        totalKm: Math.round(totalKm * 10) / 10,
        avgKmPerLieferung,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
