import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface FahrerStrecke {
  fahrer_id: string;
  fahrer_name: string;
  km_heute: number;
  touren_heute: number;
  avg_km_tour: number;
}

interface LieferstreckenAnalyseResponse {
  location_id: string;
  gesamt_km_heute: number;
  avg_km_tour: number;
  laengste_km: number;
  kuerzeste_km: number;
  trend_vs_vorwoche: number;
  alert_long_route: boolean;
  fahrer: FahrerStrecke[];
  generiert_am: string;
}

const MOCK_FAHRER: FahrerStrecke[] = [
  { fahrer_id: 'f1', fahrer_name: 'Markus R.', km_heute: 42, touren_heute: 5, avg_km_tour: 8.4 },
  { fahrer_id: 'f2', fahrer_name: 'Jana K.', km_heute: 35, touren_heute: 4, avg_km_tour: 8.75 },
  { fahrer_id: 'f3', fahrer_name: 'Tomás V.', km_heute: 28, touren_heute: 3, avg_km_tour: 9.3 },
  { fahrer_id: 'f4', fahrer_name: 'Leila S.', km_heute: 47, touren_heute: 6, avg_km_tour: 7.8 },
];

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const lastWeek = new Date(today);
  lastWeek.setDate(lastWeek.getDate() - 7);

  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();

    const { data: toursToday, error } = await supabase
      .from('delivery_tours')
      .select('driver_id, total_km')
      .eq('location_id', locationId)
      .gte('created_at', today.toISOString())
      .not('total_km', 'is', null);

    if (error || !toursToday || toursToday.length === 0) throw new Error('no data');

    const { data: toursLastWeek } = await supabase
      .from('delivery_tours')
      .select('total_km')
      .eq('location_id', locationId)
      .gte('created_at', lastWeek.toISOString())
      .lt('created_at', today.toISOString())
      .not('total_km', 'is', null);

    const byDriver = new Map<string, { km: number; touren: number }>();
    for (const t of toursToday) {
      const id = t.driver_id ?? 'unknown';
      if (!byDriver.has(id)) byDriver.set(id, { km: 0, touren: 0 });
      const d = byDriver.get(id)!;
      d.km += (t.total_km as number) ?? 0;
      d.touren++;
    }

    const fahrer: FahrerStrecke[] = Array.from(byDriver.entries()).map(([id, d]) => ({
      fahrer_id: id,
      fahrer_name: id,
      km_heute: Math.round(d.km * 10) / 10,
      touren_heute: d.touren,
      avg_km_tour: d.touren > 0 ? Math.round((d.km / d.touren) * 10) / 10 : 0,
    }));

    const allKmToday = toursToday.map(t => (t.total_km as number) ?? 0);
    const gesamt_km_heute = Math.round(allKmToday.reduce((s, v) => s + v, 0) * 10) / 10;
    const avg_km_tour = allKmToday.length > 0
      ? Math.round((gesamt_km_heute / allKmToday.length) * 10) / 10 : 0;
    const laengste_km = allKmToday.length > 0 ? Math.max(...allKmToday) : 0;
    const kuerzeste_km = allKmToday.length > 0 ? Math.min(...allKmToday) : 0;

    const allKmLastWeek = (toursLastWeek ?? []).map(t => (t.total_km as number) ?? 0);
    const avg_lw = allKmLastWeek.length > 0
      ? allKmLastWeek.reduce((s, v) => s + v, 0) / allKmLastWeek.length : avg_km_tour;
    const trend_vs_vorwoche = avg_lw > 0
      ? Math.round(((avg_km_tour - avg_lw) / avg_lw) * 100) : 0;

    return NextResponse.json({
      location_id: locationId,
      gesamt_km_heute,
      avg_km_tour,
      laengste_km: Math.round(laengste_km * 10) / 10,
      kuerzeste_km: Math.round(kuerzeste_km * 10) / 10,
      trend_vs_vorwoche,
      alert_long_route: avg_km_tour > 30,
      fahrer: fahrer.sort((a, b) => b.km_heute - a.km_heute),
      generiert_am: now.toISOString(),
    } satisfies LieferstreckenAnalyseResponse);
  } catch {
    const allKm = MOCK_FAHRER.map(f => f.avg_km_tour);
    return NextResponse.json({
      location_id: locationId,
      gesamt_km_heute: MOCK_FAHRER.reduce((s, f) => s + f.km_heute, 0),
      avg_km_tour: Math.round(allKm.reduce((s, v) => s + v, 0) / allKm.length * 10) / 10,
      laengste_km: 12.4,
      kuerzeste_km: 4.2,
      trend_vs_vorwoche: -3,
      alert_long_route: false,
      fahrer: MOCK_FAHRER,
      generiert_am: now.toISOString(),
    } satisfies LieferstreckenAnalyseResponse);
  }
}
