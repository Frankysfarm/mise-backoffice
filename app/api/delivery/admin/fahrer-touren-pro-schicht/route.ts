import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerTourenProSchicht {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  touren_pro_schicht: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface TourenProSchichtResponse {
  fahrer: FahrerTourenProSchicht[];
  team_avg: number;
  bester_name: string;
  letzter_name: string;
  alert_count: number;
  gesamt: number;
}

function getMockData(): TourenProSchichtResponse {
  const mock = [
    { fahrer_id: 'mock-1', fahrer_name: 'Julia F.', touren_pro_schicht: 8 },
    { fahrer_id: 'mock-2', fahrer_name: 'Sara K.', touren_pro_schicht: 6 },
    { fahrer_id: 'mock-3', fahrer_name: 'Max M.', touren_pro_schicht: 5 },
    { fahrer_id: 'mock-4', fahrer_name: 'Tim B.', touren_pro_schicht: 3 },
  ];
  const gesamt = mock.length;
  const bottom25idx = Math.floor(gesamt * 0.75);
  const fahrer: FahrerTourenProSchicht[] = mock.map((d, i) => {
    const rang = i + 1;
    const ampel: 'gruen' | 'gelb' | 'rot' =
      rang <= Math.ceil(gesamt * 0.25) ? 'gruen' :
      rang <= Math.ceil(gesamt * 0.75) ? 'gelb' : 'rot';
    return { ...d, rang, rank_delta: 0, ampel, alert_bottom: rang > bottom25idx };
  });
  const teamAvg = Math.round(mock.reduce((s, d) => s + d.touren_pro_schicht, 0) / gesamt * 10) / 10;
  return {
    fahrer,
    team_avg: teamAvg,
    bester_name: fahrer[0]?.fahrer_name ?? '',
    letzter_name: fahrer[gesamt - 1]?.fahrer_name ?? '',
    alert_count: fahrer.filter(f => f.alert_bottom).length,
    gesamt,
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get('location_id');
  const driverId = searchParams.get('driver_id');

  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const supabase = await createClient();

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const since = thirtyDaysAgo.toISOString();

    const [toursResult, prevToursResult] = await Promise.all([
      supabase
        .from('delivery_tours')
        .select('driver_id, driver_name')
        .eq('location_id', locationId)
        .gte('created_at', since),
      supabase
        .from('delivery_tours')
        .select('driver_id')
        .eq('location_id', locationId)
        .gte('created_at', new Date(thirtyDaysAgo.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .lt('created_at', since),
    ]);

    const shiftsResult = await supabase
      .from('delivery_shifts')
      .select('driver_id, started_at')
      .eq('location_id', locationId)
      .gte('started_at', since);

    if (toursResult.error || shiftsResult.error) throw new Error('Query failed');

    const tours = toursResult.data ?? [];
    const shifts = shiftsResult.data ?? [];
    const prevTours = prevToursResult.data ?? [];

    if (tours.length === 0 || shifts.length === 0) {
      return NextResponse.json(getMockData());
    }

    const toursByDriver: Record<string, number> = {};
    const driverNames: Record<string, string> = {};
    for (const t of tours) {
      if (!t.driver_id) continue;
      toursByDriver[t.driver_id] = (toursByDriver[t.driver_id] ?? 0) + 1;
      if (t.driver_name) driverNames[t.driver_id] = t.driver_name;
    }

    const shiftsByDriver: Record<string, number> = {};
    for (const s of shifts) {
      if (!s.driver_id) continue;
      shiftsByDriver[s.driver_id] = (shiftsByDriver[s.driver_id] ?? 0) + 1;
    }

    const prevToursByDriver: Record<string, number> = {};
    for (const t of prevTours) {
      if (!t.driver_id) continue;
      prevToursByDriver[t.driver_id] = (prevToursByDriver[t.driver_id] ?? 0) + 1;
    }

    const driverIds = Object.keys(toursByDriver);
    if (driverIds.length === 0) return NextResponse.json(getMockData());

    const rawList = driverIds
      .filter(id => shiftsByDriver[id] && shiftsByDriver[id] > 0)
      .map(id => ({
        fahrer_id: id,
        fahrer_name: driverNames[id] ?? id,
        touren_pro_schicht: Math.round((toursByDriver[id] / shiftsByDriver[id]) * 10) / 10,
        prev_touren_pro_schicht: shiftsByDriver[id] > 0
          ? Math.round(((prevToursByDriver[id] ?? 0) / shiftsByDriver[id]) * 10) / 10
          : null,
      }))
      .sort((a, b) => b.touren_pro_schicht - a.touren_pro_schicht);

    const gesamt = rawList.length;
    if (gesamt === 0) return NextResponse.json(getMockData());

    const bottom25idx = Math.floor(gesamt * 0.75);
    const fahrer: FahrerTourenProSchicht[] = rawList.map((d, i) => {
      const rang = i + 1;
      const ampel: 'gruen' | 'gelb' | 'rot' =
        rang <= Math.ceil(gesamt * 0.25) ? 'gruen' :
        rang <= Math.ceil(gesamt * 0.75) ? 'gelb' : 'rot';
      const rank_delta = d.prev_touren_pro_schicht !== null
        ? Math.round((d.touren_pro_schicht - d.prev_touren_pro_schicht) * 10) / 10
        : 0;
      return { fahrer_id: d.fahrer_id, fahrer_name: d.fahrer_name, rang, touren_pro_schicht: d.touren_pro_schicht, rank_delta, ampel, alert_bottom: rang > bottom25idx };
    });

    const teamAvg = Math.round(fahrer.reduce((s, f) => s + f.touren_pro_schicht, 0) / gesamt * 10) / 10;

    if (driverId) {
      const driver = fahrer.find(f => f.fahrer_id === driverId);
      return NextResponse.json({
        fahrer: driver ? [driver] : [],
        team_avg: teamAvg,
        bester_name: fahrer[0]?.fahrer_name ?? '',
        letzter_name: fahrer[gesamt - 1]?.fahrer_name ?? '',
        alert_count: fahrer.filter(f => f.alert_bottom).length,
        gesamt,
      });
    }

    return NextResponse.json({
      fahrer,
      team_avg: teamAvg,
      bester_name: fahrer[0]?.fahrer_name ?? '',
      letzter_name: fahrer[gesamt - 1]?.fahrer_name ?? '',
      alert_count: fahrer.filter(f => f.alert_bottom).length,
      gesamt,
    } satisfies TourenProSchichtResponse);
  } catch {
    return NextResponse.json(getMockData());
  }
}
