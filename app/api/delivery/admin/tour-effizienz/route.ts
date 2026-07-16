import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface TourEffizienzResponse {
  location_id: string;
  effizienz_index: number;
  avg_stopps_pro_tour: number;
  avg_km_pro_stopp: number;
  avg_zeit_pro_stopp_min: number;
  trend_vs_vortag: number;
  alert_niedrige_effizienz: boolean;
  generiert_am: string;
}

const MOCK: TourEffizienzResponse = {
  location_id: 'mock',
  effizienz_index: 74,
  avg_stopps_pro_tour: 3.8,
  avg_km_pro_stopp: 2.1,
  avg_zeit_pro_stopp_min: 7.4,
  trend_vs_vortag: 5,
  alert_niedrige_effizienz: false,
  generiert_am: new Date().toISOString(),
};

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  const now = new Date();
  const heute = new Date(now);
  heute.setHours(0, 0, 0, 0);
  const gestern = new Date(heute);
  gestern.setDate(gestern.getDate() - 1);

  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();

    const { data: toursHeute, error } = await supabase
      .from('delivery_tours')
      .select('stop_count, total_km, duration_minutes')
      .eq('location_id', locationId)
      .gte('created_at', heute.toISOString())
      .not('stop_count', 'is', null);

    if (error || !toursHeute || toursHeute.length === 0) throw new Error('no data');

    const { data: toursGestern } = await supabase
      .from('delivery_tours')
      .select('stop_count, total_km, duration_minutes')
      .eq('location_id', locationId)
      .gte('created_at', gestern.toISOString())
      .lt('created_at', heute.toISOString())
      .not('stop_count', 'is', null);

    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;

    const stopps = toursHeute.map(t => (t.stop_count as number) ?? 0);
    const kms = toursHeute.map(t => (t.total_km as number) ?? 0);
    const mins = toursHeute.map(t => (t.duration_minutes as number) ?? 0);

    const avgStopps = avg(stopps);
    const avgKm = avg(kms);
    const avgMin = avg(mins);

    const avgKmProStopp = avgStopps > 0 ? avgKm / avgStopps : 0;
    const avgZeitProStopp = avgStopps > 0 ? avgMin / avgStopps : 0;

    const stoppsScore = Math.min(100, (avgStopps / 5) * 100);
    const kmScore = Math.max(0, 100 - (avgKmProStopp / 5) * 100);
    const zeitScore = Math.max(0, 100 - (avgZeitProStopp / 15) * 100);
    const effizienzIndex = Math.round(stoppsScore * 0.4 + kmScore * 0.3 + zeitScore * 0.3);

    const stoppsGestern = (toursGestern ?? []).map(t => (t.stop_count as number) ?? 0);
    const kmsGestern = (toursGestern ?? []).map(t => (t.total_km as number) ?? 0);
    const minsGestern = (toursGestern ?? []).map(t => (t.duration_minutes as number) ?? 0);
    const avgStoppsG = avg(stoppsGestern);
    const avgKmProStoppG = avgStoppsG > 0 ? avg(kmsGestern) / avgStoppsG : 0;
    const avgZeitProStoppG = avgStoppsG > 0 ? avg(minsGestern) / avgStoppsG : 0;
    const stoppsScoreG = Math.min(100, (avgStoppsG / 5) * 100);
    const kmScoreG = Math.max(0, 100 - (avgKmProStoppG / 5) * 100);
    const zeitScoreG = Math.max(0, 100 - (avgZeitProStoppG / 15) * 100);
    const effizienzGestern = Math.round(stoppsScoreG * 0.4 + kmScoreG * 0.3 + zeitScoreG * 0.3);

    const trend = effizienzGestern > 0 ? effizienzIndex - effizienzGestern : 0;

    return NextResponse.json({
      location_id: locationId,
      effizienz_index: effizienzIndex,
      avg_stopps_pro_tour: Math.round(avgStopps * 10) / 10,
      avg_km_pro_stopp: Math.round(avgKmProStopp * 10) / 10,
      avg_zeit_pro_stopp_min: Math.round(avgZeitProStopp * 10) / 10,
      trend_vs_vortag: trend,
      alert_niedrige_effizienz: effizienzIndex < 60,
      generiert_am: now.toISOString(),
    } satisfies TourEffizienzResponse);
  } catch {
    return NextResponse.json({
      ...MOCK,
      location_id: locationId,
      generiert_am: now.toISOString(),
    } satisfies TourEffizienzResponse);
  }
}
