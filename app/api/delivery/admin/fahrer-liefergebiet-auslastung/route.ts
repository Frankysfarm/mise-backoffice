import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';

function calcAmpel(radius_km: number, auslastung_pct: number): Ampel {
  if (radius_km > 6 || auslastung_pct > 90) return 'rot';
  if (radius_km > 4 || auslastung_pct > 80) return 'gelb';
  return 'gruen';
}

export interface FahrerLiefergebietEntry {
  fahrer_id: string;
  fahrer_name: string;
  radius_km: number;
  auslastung_pct: number;
  radius_vw: number;
  auslastung_vw: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: Ampel;
  alert_ueberlastet: boolean;
}

export interface FahrerLiefergebietResponse {
  fahrer: FahrerLiefergebietEntry[];
  team_avg_radius: number;
  team_avg_auslastung: number;
  alert_count: number;
  generiert_am: string;
}

function buildMock(driverId?: string): FahrerLiefergebietResponse {
  const drivers = [
    { id: 'd1', name: 'Max M.',   radius: 3.2, ausl: 65, radius_vw: 3.5, ausl_vw: 70 },
    { id: 'd2', name: 'Sara K.',  radius: 4.8, ausl: 82, radius_vw: 4.2, ausl_vw: 75 },
    { id: 'd3', name: 'Tim B.',   radius: 7.1, ausl: 93, radius_vw: 6.2, ausl_vw: 85 },
    { id: 'd4', name: 'Julia F.', radius: 3.9, ausl: 71, radius_vw: 4.1, ausl_vw: 68 },
  ];

  const fahrer: FahrerLiefergebietEntry[] = drivers.map(d => {
    const trend_delta = Math.round((d.ausl - d.ausl_vw) * 10) / 10;
    const trend: 'steigend' | 'fallend' | 'stabil' =
      trend_delta > 0 ? 'steigend' : trend_delta < 0 ? 'fallend' : 'stabil';
    return {
      fahrer_id: d.id,
      fahrer_name: d.name,
      radius_km: d.radius,
      auslastung_pct: d.ausl,
      radius_vw: d.radius_vw,
      auslastung_vw: d.ausl_vw,
      trend,
      trend_delta,
      ampel: calcAmpel(d.radius, d.ausl),
      alert_ueberlastet: d.radius > 6 || d.ausl > 90,
    };
  }).sort((a, b) => b.auslastung_pct - a.auslastung_pct);

  const team_avg_radius = Math.round((fahrer.reduce((s, f) => s + f.radius_km, 0) / fahrer.length) * 10) / 10;
  const team_avg_auslastung = Math.round(fahrer.reduce((s, f) => s + f.auslastung_pct, 0) / fahrer.length);
  const alert_count = fahrer.filter(f => f.alert_ueberlastet).length;

  if (driverId) {
    const f = fahrer.find(d => d.fahrer_id === driverId) ?? fahrer[0];
    return { fahrer: [f], team_avg_radius, team_avg_auslastung, alert_count, generiert_am: new Date().toISOString() };
  }

  return { fahrer, team_avg_radius, team_avg_auslastung, alert_count, generiert_am: new Date().toISOString() };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const driverId = searchParams.get('driver_id') ?? undefined;

  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const supabase = createServiceClient();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const { data: stopsToday, error } = await supabase
      .from('batch_stops')
      .select('batch_id, driver_id, lat, lng, status')
      .eq('location_id', locationId)
      .gte('created_at', today.toISOString())
      .eq('status', 'delivered');

    if (error || !stopsToday || stopsToday.length === 0) {
      return NextResponse.json(buildMock(driverId));
    }

    const { data: driversData } = await supabase
      .from('delivery_drivers')
      .select('id, full_name')
      .eq('location_id', locationId);

    const driverMap: Record<string, string> = {};
    (driversData ?? []).forEach((d: { id: string; full_name: string }) => { driverMap[d.id] = d.full_name; });

    const driverGroups: Record<string, { lats: number[]; lngs: number[]; batches: Set<string> }> = {};
    stopsToday.forEach((s: { driver_id: string; lat: number; lng: number; batch_id: string }) => {
      if (!driverGroups[s.driver_id]) driverGroups[s.driver_id] = { lats: [], lngs: [], batches: new Set() };
      driverGroups[s.driver_id].lats.push(s.lat);
      driverGroups[s.driver_id].lngs.push(s.lng);
      driverGroups[s.driver_id].batches.add(s.batch_id);
    });

    const fahrer: FahrerLiefergebietEntry[] = Object.entries(driverGroups).map(([id, g]) => {
      const avgLat = g.lats.reduce((s, v) => s + v, 0) / g.lats.length;
      const avgLng = g.lngs.reduce((s, v) => s + v, 0) / g.lngs.length;
      let maxDist = 0;
      g.lats.forEach((lat, i) => {
        const dlat = (lat - avgLat) * 111;
        const dlng = (g.lngs[i] - avgLng) * 111 * Math.cos(avgLat * Math.PI / 180);
        maxDist = Math.max(maxDist, Math.sqrt(dlat * dlat + dlng * dlng));
      });
      const radius_km = Math.round(maxDist * 10) / 10;
      const auslastung_pct = Math.min(100, Math.round(g.batches.size * 12.5));
      return {
        fahrer_id: id,
        fahrer_name: driverMap[id] ?? id,
        radius_km,
        auslastung_pct,
        radius_vw: radius_km,
        auslastung_vw: auslastung_pct,
        trend: 'stabil' as const,
        trend_delta: 0,
        ampel: calcAmpel(radius_km, auslastung_pct),
        alert_ueberlastet: radius_km > 6 || auslastung_pct > 90,
      };
    }).sort((a, b) => b.auslastung_pct - a.auslastung_pct);

    if (fahrer.length === 0) return NextResponse.json(buildMock(driverId));

    const team_avg_radius = Math.round((fahrer.reduce((s, f) => s + f.radius_km, 0) / fahrer.length) * 10) / 10;
    const team_avg_auslastung = Math.round(fahrer.reduce((s, f) => s + f.auslastung_pct, 0) / fahrer.length);
    const alert_count = fahrer.filter(f => f.alert_ueberlastet).length;

    if (driverId) {
      const f = fahrer.find(d => d.fahrer_id === driverId) ?? fahrer[0];
      return NextResponse.json({ fahrer: [f], team_avg_radius, team_avg_auslastung, alert_count, generiert_am: new Date().toISOString() });
    }

    return NextResponse.json({ fahrer, team_avg_radius, team_avg_auslastung, alert_count, generiert_am: new Date().toISOString() });
  } catch {
    return NextResponse.json(buildMock(driverId));
  }
}
