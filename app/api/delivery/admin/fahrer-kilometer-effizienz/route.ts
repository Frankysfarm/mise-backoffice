/**
 * GET /api/delivery/admin/fahrer-kilometer-effizienz?location_id=<uuid>[&driver_id=<uuid>]
 *
 * Phase 2797 — Fahrer-Kilometer-Effizienz-API
 * Ø km je Lieferung je Fahrer heute aus mise_delivery_batches (distance_km / completed_stops).
 * Ampel grün(≤4 km)/gelb(4–6 km)/rot(>6 km);
 * Alert >6 km "Hohe Kilometerleistung!"; Trend vs. gestern; driver_id-Modus;
 * Multi-Tenant; Supabase + Mock-Fallback.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type Ampel2797 = 'gruen' | 'gelb' | 'rot';
export type Trend2797 = 'steigend' | 'fallend' | 'stabil';

export interface FahrerKilometerEffizienz {
  fahrer_id: string;
  fahrer_name: string;
  avg_km_lieferung: number;
  total_km: number;
  lieferungen: number;
  ampel: Ampel2797;
  trend: Trend2797;
  trend_delta: number;
  gestern_avg_km: number;
  alert: boolean;
  rang: number;
}

export interface KilometerEffizienzResponse {
  location_id: string;
  fahrer: FahrerKilometerEffizienz[];
  team_avg_km: number;
  alert_count: number;
  generiert_am: string;
}

const ZIEL_KM  = 4;
const WARN_KM  = 6;

function ampelVon(km: number): Ampel2797 {
  if (km <= ZIEL_KM) return 'gruen';
  if (km <= WARN_KM) return 'gelb';
  return 'rot';
}

function trendVon(heute: number, gestern: number): { trend: Trend2797; delta: number } {
  const delta = Math.round((heute - gestern) * 10) / 10;
  if (delta > 0.3) return { trend: 'steigend', delta };
  if (delta < -0.3) return { trend: 'fallend', delta };
  return { trend: 'stabil', delta };
}

const MOCK_FAHRER = [
  { fahrer_id: 'mock-f1', fahrer_name: 'Max Müller',  avg_km_lieferung: 3.2, total_km: 35.2, lieferungen: 11, gestern_avg_km: 3.5 },
  { fahrer_id: 'mock-f2', fahrer_name: 'Sara Koch',   avg_km_lieferung: 5.1, total_km: 40.8, lieferungen:  8, gestern_avg_km: 4.8 },
  { fahrer_id: 'mock-f3', fahrer_name: 'Tim Weber',   avg_km_lieferung: 7.3, total_km: 58.4, lieferungen:  8, gestern_avg_km: 6.9 },
  { fahrer_id: 'mock-f4', fahrer_name: 'Anna Bauer',  avg_km_lieferung: 2.8, total_km: 28.0, lieferungen: 10, gestern_avg_km: 3.1 },
];

function buildMock(locationId: string, driverId?: string | null): KilometerEffizienzResponse {
  let src = MOCK_FAHRER;
  if (driverId) src = src.filter(f => f.fahrer_id === driverId);
  const sorted = [...src].sort((a, b) => a.avg_km_lieferung - b.avg_km_lieferung);
  const fahrer: FahrerKilometerEffizienz[] = sorted.map((f, i) => {
    const { trend, delta } = trendVon(f.avg_km_lieferung, f.gestern_avg_km);
    return {
      ...f,
      ampel: ampelVon(f.avg_km_lieferung),
      trend,
      trend_delta: delta,
      alert: f.avg_km_lieferung > WARN_KM,
      rang: i + 1,
    };
  });
  const team_avg_km =
    fahrer.length > 0
      ? Math.round((fahrer.reduce((s, f) => s + f.avg_km_lieferung, 0) / fahrer.length) * 10) / 10
      : 0;
  return {
    location_id: locationId,
    fahrer,
    team_avg_km,
    alert_count: fahrer.filter(f => f.alert).length,
    generiert_am: new Date().toISOString(),
  };
}

type BatchRow = {
  driver_id: string | null;
  distance_km: number | null;
  completed_stops: number | null;
};

function calcKm(batches: BatchRow[]): { avg_km: number; total_km: number; lieferungen: number } {
  const relevant = batches.filter(b => (b.completed_stops ?? 0) > 0);
  if (relevant.length === 0) return { avg_km: 0, total_km: 0, lieferungen: 0 };
  const total_km    = relevant.reduce((s, b) => s + (b.distance_km ?? 0), 0);
  const lieferungen = relevant.reduce((s, b) => s + (b.completed_stops ?? 0), 0);
  const avg_km = lieferungen > 0 ? Math.round((total_km / lieferungen) * 10) / 10 : 0;
  return { avg_km, total_km: Math.round(total_km * 10) / 10, lieferungen };
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const locationId = searchParams.get('location_id');
  const driverId   = searchParams.get('driver_id');
  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const sb  = await createClient();
    const now = new Date();

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const gestStart = new Date(todayStart.getTime() - 86_400_000);
    const gestEnd   = todayStart;

    const { data: drivers, error: dErr } = await sb
      .from('mise_drivers')
      .select('id, full_name')
      .eq('location_id', locationId)
      .in('status', ['online', 'busy', 'delivering', 'returning', 'active']);

    if (dErr || !drivers || drivers.length === 0) {
      return NextResponse.json(buildMock(locationId, driverId));
    }

    type Driver = { id: string; full_name: string | null };
    const filteredDrivers = driverId
      ? (drivers as Driver[]).filter(d => d.id === driverId)
      : (drivers as Driver[]);

    const { data: batchesToday } = await sb
      .from('mise_delivery_batches')
      .select('driver_id, distance_km, completed_stops')
      .eq('location_id', locationId)
      .gte('created_at', todayStart.toISOString())
      .eq('status', 'completed');

    const { data: batchesGestern } = await sb
      .from('mise_delivery_batches')
      .select('driver_id, distance_km, completed_stops')
      .eq('location_id', locationId)
      .gte('created_at', gestStart.toISOString())
      .lt('created_at', gestEnd.toISOString())
      .eq('status', 'completed');

    const todayRows = (batchesToday  ?? []) as BatchRow[];
    const gestRows  = (batchesGestern ?? []) as BatchRow[];

    const unsorted = filteredDrivers.map((d: Driver) => {
      const mine      = todayRows.filter(b => b.driver_id === d.id);
      const meineGest = gestRows.filter(b => b.driver_id === d.id);
      const { avg_km, total_km, lieferungen } = calcKm(mine);
      const { avg_km: gestern_avg_km }        = calcKm(meineGest);
      const { trend, delta } = trendVon(avg_km, gestern_avg_km);
      return {
        fahrer_id: d.id,
        fahrer_name: d.full_name ?? 'Fahrer',
        avg_km_lieferung: avg_km,
        total_km,
        lieferungen,
        ampel: ampelVon(avg_km),
        trend,
        trend_delta: delta,
        alert: avg_km > WARN_KM,
        gestern_avg_km,
      };
    });

    const sorted = [...unsorted].sort((a, b) => a.avg_km_lieferung - b.avg_km_lieferung);
    const fahrer: FahrerKilometerEffizienz[] = sorted.map((f, i) => ({ ...f, rang: i + 1 }));

    const team_avg_km =
      fahrer.length > 0
        ? Math.round((fahrer.reduce((s, f) => s + f.avg_km_lieferung, 0) / fahrer.length) * 10) / 10
        : 0;

    return NextResponse.json({
      location_id: locationId,
      fahrer,
      team_avg_km,
      alert_count: fahrer.filter(f => f.alert).length,
      generiert_am: now.toISOString(),
    } satisfies KilometerEffizienzResponse);
  } catch {
    return NextResponse.json(buildMock(locationId, driverId));
  }
}
