/**
 * GET /api/delivery/admin/fahrer-strecken-effizienz?location_id=<uuid>[&driver_id=<uuid>]
 *
 * Phase 2736 — Fahrer-Strecken-Effizienz Backend
 *
 * km/Tour je Fahrer heute (route_distance_km / Touren-Count).
 * Ampel: grün(≤5 km/Tour) / gelb(5–8 km/Tour) / rot(>8 km/Tour).
 * Alert >8 km/Tour: "Hohe Kilometer pro Tour!"
 * Trend vs. gestern. Multi-Tenant; Supabase(delivery_batches) + Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';
type Trend = 'steigend' | 'fallend' | 'stabil';

interface FahrerEftizienz {
  fahrer_id: string;
  fahrer_name: string;
  km_pro_tour: number;
  touren: number;
  gesamt_km: number;
  km_pro_tour_gestern: number | null;
  trend: Trend;
  trend_delta: number;
  ampel: Ampel;
  alert: string | null;
  rang: number;
}

interface ResponseData {
  location_id: string;
  fahrer: FahrerEftizienz[];
  team_avg_km_pro_tour: number;
  alert_count: number;
  generiert_am: string;
}

const MOCK: ResponseData = {
  location_id: 'mock',
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   km_pro_tour: 3.8, touren: 10, gesamt_km: 38,  km_pro_tour_gestern: 4.1, trend: 'fallend',  trend_delta: -0.3, ampel: 'gruen', alert: null,                          rang: 1 },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  km_pro_tour: 5.5, touren:  8, gesamt_km: 44,  km_pro_tour_gestern: 5.2, trend: 'steigend', trend_delta:  0.3, ampel: 'gelb',  alert: null,                          rang: 2 },
    { fahrer_id: 'f3', fahrer_name: 'Tim B.',   km_pro_tour: 7.2, touren:  6, gesamt_km: 43.2,km_pro_tour_gestern: 7.0, trend: 'steigend', trend_delta:  0.2, ampel: 'gelb',  alert: null,                          rang: 3 },
    { fahrer_id: 'f4', fahrer_name: 'Julia F.', km_pro_tour: 9.4, touren:  5, gesamt_km: 47,  km_pro_tour_gestern: 8.1, trend: 'steigend', trend_delta:  1.3, ampel: 'rot',   alert: 'Hohe Kilometer pro Tour!',    rang: 4 },
  ],
  team_avg_km_pro_tour: 6.5,
  alert_count: 1,
  generiert_am: new Date().toISOString(),
};

function calcAmpel(km: number): Ampel {
  if (km <= 5) return 'gruen';
  if (km <= 8) return 'gelb';
  return 'rot';
}

function calcTrend(heute: number, gestern: number | null): { trend: Trend; delta: number } {
  if (gestern === null) return { trend: 'stabil', delta: 0 };
  const delta = Math.round((heute - gestern) * 10) / 10;
  if (delta >  0.3) return { trend: 'steigend', delta };
  if (delta < -0.3) return { trend: 'fallend',  delta };
  return { trend: 'stabil', delta };
}

type BatchRow = {
  driver_id: string;
  route_distance_km: number | null;
  total_distance_km: number | null;
  state: string;
};

function extractKm(row: BatchRow): number {
  return row.route_distance_km ?? row.total_distance_km ?? 0;
}

function aggregateForDrivers(batches: BatchRow[]): Map<string, { km: number; tours: number }> {
  const map = new Map<string, { km: number; tours: number }>();
  for (const b of batches) {
    const km = extractKm(b);
    const prev = map.get(b.driver_id) ?? { km: 0, tours: 0 };
    map.set(b.driver_id, { km: prev.km + km, tours: prev.tours + 1 });
  }
  return map;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const driverId   = searchParams.get('driver_id');

  if (!locationId) return NextResponse.json(MOCK);

  try {
    const sb = createServiceClient();
    const now      = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const yesterday = new Date(now.getTime() - 86_400_000);
    const yStr     = yesterday.toISOString().slice(0, 10);

    const buildQ = (dateStr: string) => {
      const q = sb
        .from('delivery_batches')
        .select('driver_id, route_distance_km, total_distance_km, state')
        .eq('location_id', locationId)
        .gte('created_at', `${dateStr}T00:00:00Z`)
        .lt('created_at',  `${dateStr}T23:59:59Z`)
        .neq('state', 'cancelled');
      if (driverId) q.eq('driver_id', driverId);
      return q;
    };

    const { data: todayBatches  } = await buildQ(todayStr);
    const { data: yesterdayBatches } = await buildQ(yStr);

    if (!todayBatches?.length) return NextResponse.json(MOCK);

    const todayMap = aggregateForDrivers(todayBatches as BatchRow[]);
    const yMap     = aggregateForDrivers((yesterdayBatches ?? []) as BatchRow[]);

    const driverIds = [...todayMap.keys()];
    const { data: driversRaw } = await sb
      .from('delivery_drivers')
      .select('id, name')
      .in('id', driverIds);

    const nameMap = Object.fromEntries(
      (driversRaw ?? []).map((d: { id: string; name: string }) => [d.id, d.name])
    );

    const fahrer: FahrerEftizienz[] = driverIds.map((dId, idx) => {
      const today   = todayMap.get(dId)!;
      const kmTour  = today.tours > 0 ? Math.round((today.km / today.tours) * 10) / 10 : 0;
      const yEntry  = yMap.get(dId);
      const kmGest  = yEntry && yEntry.tours > 0
        ? Math.round((yEntry.km / yEntry.tours) * 10) / 10
        : null;
      const ampel   = calcAmpel(kmTour);
      const { trend, delta } = calcTrend(kmTour, kmGest);

      return {
        fahrer_id:           dId,
        fahrer_name:         nameMap[dId] ?? `Fahrer ${idx + 1}`,
        km_pro_tour:         kmTour,
        touren:              today.tours,
        gesamt_km:           Math.round(today.km * 10) / 10,
        km_pro_tour_gestern: kmGest,
        trend,
        trend_delta:         delta,
        ampel,
        alert: ampel === 'rot' ? 'Hohe Kilometer pro Tour!' : null,
        rang:  idx + 1,
      };
    }).sort((a, b) => a.km_pro_tour - b.km_pro_tour).map((f, i) => ({ ...f, rang: i + 1 }));

    return NextResponse.json({
      location_id: locationId,
      fahrer,
      team_avg_km_pro_tour: fahrer.length
        ? Math.round((fahrer.reduce((s, f) => s + f.km_pro_tour, 0) / fahrer.length) * 10) / 10
        : 0,
      alert_count:  fahrer.filter(f => f.alert).length,
      generiert_am: new Date().toISOString(),
    } as ResponseData);
  } catch {
    return NextResponse.json(MOCK);
  }
}
