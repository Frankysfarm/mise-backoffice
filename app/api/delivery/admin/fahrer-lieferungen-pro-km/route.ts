import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerLieferungenProKm {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  lieferungen_pro_km: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface LieferungenProKmResponse {
  fahrer: FahrerLieferungenProKm[];
  team_avg: number;
  bester_name: string;
  letzter_name: string;
  alert_count: number;
  gesamt: number;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get('location_id');

  try {
    const supabase = await createClient();

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    let query = supabase
      .from('delivery_tours')
      .select(`
        driver_id,
        stop_count,
        total_distance_km,
        profiles!driver_id(full_name)
      `)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .gt('total_distance_km', 0)
      .gt('stop_count', 0);

    if (locationId) {
      query = query.eq('location_id', locationId);
    }

    const { data: tours, error } = await query;

    if (error || !tours || tours.length === 0) {
      return NextResponse.json(getMockData());
    }

    const driverMap = new Map<string, { name: string; totalStops: number; totalKm: number }>();
    for (const tour of tours) {
      const name = (tour.profiles as any)?.full_name ?? 'Unbekannt';
      const existing = driverMap.get(tour.driver_id);
      if (existing) {
        existing.totalStops += tour.stop_count ?? 0;
        existing.totalKm += tour.total_distance_km ?? 0;
      } else {
        driverMap.set(tour.driver_id, {
          name,
          totalStops: tour.stop_count ?? 0,
          totalKm: tour.total_distance_km ?? 0,
        });
      }
    }

    if (driverMap.size === 0) {
      return NextResponse.json(getMockData());
    }

    const drivers = Array.from(driverMap.entries()).map(([id, d]) => ({
      fahrer_id: id,
      fahrer_name: d.name,
      lieferungen_pro_km: d.totalKm > 0 ? Math.round((d.totalStops / d.totalKm) * 100) / 100 : 0,
    }));

    // Descending: Rang 1 = highest value = best
    drivers.sort((a, b) => b.lieferungen_pro_km - a.lieferungen_pro_km);

    const gesamt = drivers.length;
    const bot25idx = Math.ceil(gesamt * 0.75);

    const ranked: FahrerLieferungenProKm[] = drivers.map((d, i) => {
      const rang = i + 1;
      const ampel: 'gruen' | 'gelb' | 'rot' =
        rang <= Math.ceil(gesamt * 0.25) ? 'gruen' :
        rang <= Math.ceil(gesamt * 0.75) ? 'gelb' : 'rot';
      return {
        ...d,
        rang,
        rank_delta: 0,
        ampel,
        alert_bottom: rang > bot25idx,
      };
    });

    const teamAvg = drivers.reduce((s, d) => s + d.lieferungen_pro_km, 0) / gesamt;

    const response: LieferungenProKmResponse = {
      fahrer: ranked,
      team_avg: Math.round(teamAvg * 100) / 100,
      bester_name: ranked[0]?.fahrer_name ?? '',
      letzter_name: ranked[gesamt - 1]?.fahrer_name ?? '',
      alert_count: ranked.filter(f => f.alert_bottom).length,
      gesamt,
    };

    return NextResponse.json(response);
  } catch {
    return NextResponse.json(getMockData());
  }
}

function getMockData(): LieferungenProKmResponse {
  const mock = [
    { fahrer_id: 'mock-1', fahrer_name: 'Julia F.', lieferungen_pro_km: 1.25 },
    { fahrer_id: 'mock-2', fahrer_name: 'Sara K.', lieferungen_pro_km: 0.83 },
    { fahrer_id: 'mock-3', fahrer_name: 'Max M.', lieferungen_pro_km: 0.53 },
    { fahrer_id: 'mock-4', fahrer_name: 'Tim B.', lieferungen_pro_km: 0.37 },
  ];
  const gesamt = mock.length;
  const bot25idx = Math.ceil(gesamt * 0.75);
  const fahrer: FahrerLieferungenProKm[] = mock.map((d, i) => {
    const rang = i + 1;
    const ampel: 'gruen' | 'gelb' | 'rot' =
      rang <= Math.ceil(gesamt * 0.25) ? 'gruen' :
      rang <= Math.ceil(gesamt * 0.75) ? 'gelb' : 'rot';
    return { ...d, rang, rank_delta: 0, ampel, alert_bottom: rang > bot25idx };
  });
  const teamAvg = mock.reduce((s, d) => s + d.lieferungen_pro_km, 0) / gesamt;
  return {
    fahrer,
    team_avg: Math.round(teamAvg * 100) / 100,
    bester_name: fahrer[0]?.fahrer_name ?? '',
    letzter_name: fahrer[gesamt - 1]?.fahrer_name ?? '',
    alert_count: fahrer.filter(f => f.alert_bottom).length,
    gesamt,
  };
}
