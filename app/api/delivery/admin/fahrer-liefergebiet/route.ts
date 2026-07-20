/**
 * GET /api/delivery/admin/fahrer-liefergebiet?location_id=<uuid>[&driver_id=<uuid>]
 *
 * Phase 2761 — Fahrer-Liefergebiet-Abdeckung Backend
 *
 * Anzahl belieferter Zonen je Fahrer heute.
 * Ampel: grün(≥3 Zonen) / gelb(2 Zonen) / rot(1 Zone).
 * Alert ≤1 Zone: "Geringe Gebietsabdeckung!"
 * Trend vs. gestern. Multi-Tenant; Supabase(batch_stops.zone + delivery_tours.zone_id) + Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';
type Trend = 'steigend' | 'fallend' | 'stabil';

interface FahrerGebiet {
  fahrer_id: string;
  fahrer_name: string;
  zonen_count: number;
  touren: number;
  zonen_count_gestern: number | null;
  trend: Trend;
  trend_delta: number;
  ampel: Ampel;
  alert: string | null;
  rang: number;
}

interface ResponseData {
  location_id: string;
  fahrer: FahrerGebiet[];
  team_avg_zonen: number;
  alert_count: number;
  generiert_am: string;
}

const MOCK: ResponseData = {
  location_id: 'mock',
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   zonen_count: 4, touren: 10, zonen_count_gestern: 3, trend: 'steigend', trend_delta:  1, ampel: 'gruen', alert: null,                        rang: 1 },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  zonen_count: 3, touren:  8, zonen_count_gestern: 3, trend: 'stabil',   trend_delta:  0, ampel: 'gruen', alert: null,                        rang: 2 },
    { fahrer_id: 'f3', fahrer_name: 'Tim B.',   zonen_count: 2, touren:  6, zonen_count_gestern: 3, trend: 'fallend',  trend_delta: -1, ampel: 'gelb',  alert: null,                        rang: 3 },
    { fahrer_id: 'f4', fahrer_name: 'Julia F.', zonen_count: 1, touren:  5, zonen_count_gestern: 2, trend: 'fallend',  trend_delta: -1, ampel: 'rot',   alert: 'Geringe Gebietsabdeckung!', rang: 4 },
  ],
  team_avg_zonen: 2.5,
  alert_count: 1,
  generiert_am: new Date().toISOString(),
};

function calcAmpel(zonen: number): Ampel {
  if (zonen >= 3) return 'gruen';
  if (zonen >= 2) return 'gelb';
  return 'rot';
}

function calcTrend(heute: number, gestern: number | null): { trend: Trend; delta: number } {
  if (gestern === null) return { trend: 'stabil', delta: 0 };
  const delta = heute - gestern;
  if (delta > 0) return { trend: 'steigend', delta };
  if (delta < 0) return { trend: 'fallend',  delta };
  return { trend: 'stabil', delta: 0 };
}

type StopRow = { driver_id: string; zone: string | null };

function aggregateZones(stops: StopRow[]): Map<string, { zones: Set<string>; count: number }> {
  const map = new Map<string, { zones: Set<string>; count: number }>();
  for (const s of stops) {
    const zone = s.zone?.trim() || '';
    if (!zone) continue;
    const prev = map.get(s.driver_id) ?? { zones: new Set<string>(), count: 0 };
    prev.zones.add(zone);
    prev.count++;
    map.set(s.driver_id, prev);
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
    const now       = new Date();
    const todayStr  = now.toISOString().slice(0, 10);
    const yesterday = new Date(now.getTime() - 86_400_000);
    const yStr      = yesterday.toISOString().slice(0, 10);

    const buildQ = (dateStr: string) => {
      const q = sb
        .from('delivery_batch_stops')
        .select('driver_id, zone:delivery_zone')
        .eq('location_id', locationId)
        .gte('created_at', `${dateStr}T00:00:00Z`)
        .lt('created_at',  `${dateStr}T23:59:59Z`);
      if (driverId) q.eq('driver_id', driverId);
      return q;
    };

    const { data: todayStops } = await buildQ(todayStr);
    const { data: yStops     } = await buildQ(yStr);

    if (!todayStops?.length) return NextResponse.json(MOCK);

    const todayMap = aggregateZones(todayStops as StopRow[]);
    const yMap     = aggregateZones((yStops ?? []) as StopRow[]);

    if (todayMap.size === 0) return NextResponse.json(MOCK);

    const driverIds = [...todayMap.keys()];
    const { data: driversRaw } = await sb
      .from('delivery_drivers')
      .select('id, name')
      .in('id', driverIds);

    const nameMap = Object.fromEntries(
      (driversRaw ?? []).map((d: { id: string; name: string }) => [d.id, d.name])
    );

    const fahrer: FahrerGebiet[] = driverIds.map((dId, idx) => {
      const today     = todayMap.get(dId)!;
      const zonenCnt  = today.zones.size;
      const yEntry    = yMap.get(dId);
      const zonenGest = yEntry ? yEntry.zones.size : null;
      const ampel     = calcAmpel(zonenCnt);
      const { trend, delta } = calcTrend(zonenCnt, zonenGest);

      return {
        fahrer_id:           dId,
        fahrer_name:         nameMap[dId] ?? `Fahrer ${idx + 1}`,
        zonen_count:         zonenCnt,
        touren:              today.count,
        zonen_count_gestern: zonenGest,
        trend,
        trend_delta:         delta,
        ampel,
        alert:               zonenCnt <= 1 ? 'Geringe Gebietsabdeckung!' : null,
        rang:                idx + 1,
      };
    });

    // Absteigend: meiste Zonen (breiteste Abdeckung) zuerst
    fahrer.sort((a, b) => b.zonen_count - a.zonen_count);
    fahrer.forEach((f, i) => { f.rang = i + 1; });

    const teamAvg = fahrer.length > 0
      ? Math.round((fahrer.reduce((s, f) => s + f.zonen_count, 0) / fahrer.length) * 10) / 10
      : 0;

    return NextResponse.json({
      location_id: locationId,
      fahrer,
      team_avg_zonen: teamAvg,
      alert_count: fahrer.filter(f => f.alert !== null).length,
      generiert_am: new Date().toISOString(),
    } satisfies ResponseData);
  } catch {
    return NextResponse.json(MOCK);
  }
}
