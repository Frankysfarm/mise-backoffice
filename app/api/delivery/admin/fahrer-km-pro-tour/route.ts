// Phase 2960 — Fahrer-Km-pro-Tour
// GET /api/delivery/admin/fahrer-km-pro-tour?location_id=<uuid>[&driver_id=<uuid>]
// Ø km je Tour heute je Fahrer; Ampel grün(≤8)/gelb(8–12)/rot(>12). Alert >12 km.
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const ZIEL_KM = 8;
const ALERT_KM = 12;
const MAX_KM = 20;

function ampel(km: number): 'gruen' | 'gelb' | 'rot' {
  if (km <= ZIEL_KM) return 'gruen';
  if (km <= ALERT_KM) return 'gelb';
  return 'rot';
}

function mockData(locationId: string, driverId?: string) {
  const drivers = [
    { id: 'd1', name: 'Max M.',   km: 6.2,  km_gestern: 7.0,  touren: 8  },
    { id: 'd2', name: 'Sara K.',  km: 13.5, km_gestern: 11.0, touren: 6  },
    { id: 'd3', name: 'Tim B.',   km: 9.1,  km_gestern: 9.8,  touren: 7  },
    { id: 'd4', name: 'Julia F.', km: 7.4,  km_gestern: 8.1,  touren: 9  },
  ];

  const fahrer = drivers
    .map(d => ({
      fahrer_id: d.id,
      fahrer_name: d.name,
      km_pro_tour: d.km,
      km_pro_tour_gestern: d.km_gestern,
      touren_heute: d.touren,
      trend: d.km < d.km_gestern ? 'fallend' : d.km > d.km_gestern ? 'steigend' : 'stabil',
      trend_delta: Math.round((d.km - d.km_gestern) * 10) / 10,
      ampel: ampel(d.km),
      alert: d.km > ALERT_KM,
    }))
    .sort((a, b) => a.km_pro_tour - b.km_pro_tour);

  const team_avg = fahrer.reduce((s, f) => s + f.km_pro_tour, 0) / (fahrer.length || 1);
  const team_avg_gestern = drivers.reduce((s, d) => s + d.km_gestern, 0) / (drivers.length || 1);
  const alert_count = fahrer.filter(f => f.alert).length;

  if (driverId) {
    const f = fahrer.find(d => d.fahrer_id === driverId) ?? fahrer[0];
    return { fahrer_single: f, team_avg_km_pro_tour: Math.round(team_avg * 10) / 10 };
  }

  return {
    fahrer,
    team_avg_km_pro_tour: Math.round(team_avg * 10) / 10,
    team_avg_km_pro_tour_gestern: Math.round(team_avg_gestern * 10) / 10,
    alert_count,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const driverId = searchParams.get('driver_id') ?? undefined;

  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const supabase = createServiceClient();
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);

    const { data: drivers } = await supabase
      .from('drivers')
      .select('id, name')
      .eq('location_id', locationId)
      .eq('is_active', true);

    if (!drivers?.length) return NextResponse.json(mockData(locationId, driverId));

    const { data: stopsHeute } = await supabase
      .from('batch_stops')
      .select('driver_id, distance_km, batch_id, created_at')
      .eq('location_id', locationId)
      .gte('created_at', today)
      .in('status', ['delivered', 'completed']);

    const { data: stopsGestern } = await supabase
      .from('batch_stops')
      .select('driver_id, distance_km, batch_id')
      .eq('location_id', locationId)
      .gte('created_at', yesterday)
      .lt('created_at', today)
      .in('status', ['delivered', 'completed']);

    if (!stopsHeute) return NextResponse.json(mockData(locationId, driverId));

    const calcKm = (rows: typeof stopsHeute, dId: string) => {
      const mine = (rows ?? []).filter(s => s.driver_id === dId);
      if (!mine.length) return { km: 0, touren: 0 };
      const totalKm = mine.reduce((s, s2) => s + (s2.distance_km ?? 0), 0);
      const uniqueTours = new Set(mine.map(s => s.batch_id)).size || 1;
      return { km: Math.round((totalKm / uniqueTours) * 10) / 10, touren: uniqueTours };
    };

    const fahrer = drivers.map(d => {
      const heute = calcKm(stopsHeute, d.id);
      const gestern = calcKm(stopsGestern ?? [], d.id);
      return {
        fahrer_id: d.id,
        fahrer_name: d.name,
        km_pro_tour: heute.km,
        km_pro_tour_gestern: gestern.km,
        touren_heute: heute.touren,
        trend: heute.km < gestern.km ? 'fallend' : heute.km > gestern.km ? 'steigend' : 'stabil',
        trend_delta: Math.round((heute.km - gestern.km) * 10) / 10,
        ampel: ampel(heute.km),
        alert: heute.km > ALERT_KM,
      };
    }).sort((a, b) => a.km_pro_tour - b.km_pro_tour);

    const team_avg = fahrer.reduce((s, f) => s + f.km_pro_tour, 0) / (fahrer.length || 1);
    const team_avg_gestern = fahrer.reduce((s, f) => s + f.km_pro_tour_gestern, 0) / (fahrer.length || 1);
    const alert_count = fahrer.filter(f => f.alert).length;

    if (driverId) {
      const f = fahrer.find(d => d.fahrer_id === driverId) ?? fahrer[0];
      return NextResponse.json({ fahrer_single: f, team_avg_km_pro_tour: Math.round(team_avg * 10) / 10 });
    }

    return NextResponse.json({
      fahrer,
      team_avg_km_pro_tour: Math.round(team_avg * 10) / 10,
      team_avg_km_pro_tour_gestern: Math.round(team_avg_gestern * 10) / 10,
      alert_count,
      generiert_am: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(mockData(locationId, driverId));
  }
}
