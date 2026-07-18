/**
 * GET /api/delivery/admin/fahrer-kilometer?location_id=...&driver_id=...
 *
 * Gefahrene km je Fahrer heute aus delivery_tours (distance_km).
 * Ø km/Tour + Gesamt-km. Alert wenn Gesamt >150 km (Überbelastung).
 * Ampel grün(<100km)/gelb(100–150km)/rot(>150km). Trend vs. Vorwoche.
 * driver_id-Modus für Fahrer-App. Multi-Tenant; Supabase+Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface FahrerKilometer {
  id: string;
  name: string;
  km_gesamt: number;
  km_gesamt_vw: number;
  km_pro_tour: number;
  touren: number;
  trend: 'up' | 'down' | 'neutral';
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: boolean;
}

export interface KilometerResponse {
  fahrer: FahrerKilometer[];
  team_km_gesamt: number;
  team_km_gesamt_vw: number;
  alert_count: number;
  generiert_am: string;
  mock?: boolean;
}

function classifyAmpel(km: number): 'gruen' | 'gelb' | 'rot' {
  if (km < 100) return 'gruen';
  if (km <= 150) return 'gelb';
  return 'rot';
}

function mockData(): KilometerResponse {
  const fahrer: FahrerKilometer[] = [
    { id: 'd1', name: 'Anna K.', km_gesamt: 74.2, km_gesamt_vw: 80.1, km_pro_tour: 6.2, touren: 12, trend: 'up', ampel: 'gruen', alert: false },
    { id: 'd2', name: 'Ben T.', km_gesamt: 118.5, km_gesamt_vw: 105.0, km_pro_tour: 7.9, touren: 15, trend: 'down', ampel: 'gelb', alert: false },
    { id: 'd3', name: 'Chris M.', km_gesamt: 163.4, km_gesamt_vw: 140.0, km_pro_tour: 11.7, touren: 14, trend: 'down', ampel: 'rot', alert: true },
    { id: 'd4', name: 'Diana P.', km_gesamt: 55.8, km_gesamt_vw: 60.2, km_pro_tour: 5.1, touren: 11, trend: 'up', ampel: 'gruen', alert: false },
  ];
  const sorted = [...fahrer].sort((a, b) => a.km_gesamt - b.km_gesamt);
  const team_km_gesamt = Math.round((sorted.reduce((s, d) => s + d.km_gesamt, 0) / sorted.length) * 10) / 10;
  const team_km_gesamt_vw = Math.round((sorted.reduce((s, d) => s + d.km_gesamt_vw, 0) / sorted.length) * 10) / 10;
  return {
    fahrer: sorted,
    team_km_gesamt,
    team_km_gesamt_vw,
    alert_count: sorted.filter(d => d.alert).length,
    generiert_am: new Date().toISOString(),
    mock: true,
  };
}

async function resolveLocationId(userId: string): Promise<string | null> {
  const sb = await createClient();
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('user_id', userId)
    .single();
  return (emp?.location_id as string) ?? null;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let locationId = searchParams.get('location_id');
    const driverId = searchParams.get('driver_id');

    try {
      const sb = await createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (user && !locationId) locationId = await resolveLocationId(user.id);
    } catch {
      // unauthenticated — fall through to mock
    }

    if (!locationId) {
      return NextResponse.json({ ok: true, ...mockData() });
    }

    const ssb = await createServiceClient();
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const vwStart = new Date(todayStart.getTime() - 7 * 24 * 3_600_000);
    const vwEnd = new Date(todayStart.getTime() - 6 * 24 * 3_600_000);

    const { data: driversRaw } = await ssb
      .from('drivers')
      .select('id, name')
      .eq('location_id', locationId);

    if (!driversRaw || driversRaw.length === 0) {
      return NextResponse.json({ ok: true, ...mockData() });
    }

    const driverIds = (driversRaw as { id: string }[]).map((d) => d.id);

    const { data: toursToday } = await ssb
      .from('delivery_tours')
      .select('driver_id, distance_km, status')
      .eq('location_id', locationId)
      .in('driver_id', driverIds)
      .gte('created_at', todayStart.toISOString());

    const { data: toursVW } = await ssb
      .from('delivery_tours')
      .select('driver_id, distance_km')
      .eq('location_id', locationId)
      .in('driver_id', driverIds)
      .gte('created_at', vwStart.toISOString())
      .lt('created_at', vwEnd.toISOString());

    function buildMap(tours: Array<{ driver_id: string; distance_km?: number | null }>) {
      const map = new Map<string, { km: number; touren: number }>();
      for (const t of tours) {
        if (!map.has(t.driver_id)) map.set(t.driver_id, { km: 0, touren: 0 });
        const e = map.get(t.driver_id)!;
        e.km += Number(t.distance_km ?? 0);
        e.touren++;
      }
      return map;
    }

    const todayMap = buildMap(
      (toursToday ?? []) as Array<{ driver_id: string; distance_km?: number | null }>
    );
    const vwMap = buildMap(
      (toursVW ?? []) as Array<{ driver_id: string; distance_km?: number | null }>
    );

    const fahrer: FahrerKilometer[] = (driversRaw as { id: string; name: string }[]).map((d) => {
      const t = todayMap.get(d.id) ?? { km: 0, touren: 0 };
      const v = vwMap.get(d.id) ?? { km: 0, touren: 0 };

      const km = Math.round(t.km * 10) / 10;
      const kmVW = Math.round(v.km * 10) / 10;
      const kmProTour = t.touren > 0 ? Math.round((t.km / t.touren) * 10) / 10 : 0;

      const trend: 'up' | 'down' | 'neutral' =
        km < kmVW - 1 ? 'up' : km > kmVW + 1 ? 'down' : 'neutral';
      const ampel = classifyAmpel(km);

      return {
        id: d.id,
        name: d.name as string,
        km_gesamt: km,
        km_gesamt_vw: kmVW,
        km_pro_tour: kmProTour,
        touren: t.touren,
        trend,
        ampel,
        alert: km > 150,
      };
    });

    const sorted = fahrer.filter(f => f.touren > 0).sort((a, b) => a.km_gesamt - b.km_gesamt);
    const all = sorted.length > 0 ? sorted : fahrer;

    if (driverId) {
      const f = fahrer.find(d => d.id === driverId) ?? all[0] ?? null;
      const team_km_gesamt = all.length > 0
        ? Math.round((all.reduce((s, d) => s + d.km_gesamt, 0) / all.length) * 10) / 10
        : 0;
      return NextResponse.json({ ok: true, fahrer_single: f, team_km_gesamt, generiert_am: now.toISOString() });
    }

    const team_km_gesamt = all.length > 0
      ? Math.round((all.reduce((s, d) => s + d.km_gesamt, 0) / all.length) * 10) / 10
      : 0;
    const team_km_gesamt_vw = all.length > 0
      ? Math.round((all.reduce((s, d) => s + d.km_gesamt_vw, 0) / all.length) * 10) / 10
      : 0;

    return NextResponse.json({
      ok: true,
      fahrer: all,
      team_km_gesamt,
      team_km_gesamt_vw,
      alert_count: all.filter(d => d.alert).length,
      generiert_am: now.toISOString(),
    });
  } catch (err) {
    console.error('[fahrer-kilometer]', err);
    return NextResponse.json({ ok: true, ...mockData() });
  }
}
