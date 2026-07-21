/**
 * GET /api/delivery/admin/fahrer-touren-pro-tag?location_id=<uuid>[&driver_id=<uuid>]
 *
 * Phase 2975 — Fahrer-Touren-pro-Tag-Index Backend
 *
 * Anzahl abgeschlossener Touren (distinct batch_ids) je Fahrer heute.
 * Ampel: grün(≥3 Touren) / gelb(=2) / rot(<2).
 * Alert <2 Touren: "Zu wenige Touren!"
 * Trend vs. gestern. Multi-Tenant; Supabase(batch_stops) + Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';
type Trend = 'steigend' | 'fallend' | 'stabil';

interface FahrerTouren {
  fahrer_id: string;
  fahrer_name: string;
  touren_heute: number;
  touren_gestern: number | null;
  trend: Trend;
  trend_delta: number;
  ampel: Ampel;
  alert: string | null;
  rang: number;
}

interface ResponseData {
  location_id: string;
  fahrer: FahrerTouren[];
  team_avg_touren: number;
  alert_count: number;
  generiert_am: string;
}

const MOCK: ResponseData = {
  location_id: 'mock',
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   touren_heute: 4, touren_gestern: 3, trend: 'steigend', trend_delta:  1, ampel: 'gruen', alert: null,                rang: 1 },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  touren_heute: 3, touren_gestern: 3, trend: 'stabil',   trend_delta:  0, ampel: 'gruen', alert: null,                rang: 2 },
    { fahrer_id: 'f3', fahrer_name: 'Tim B.',   touren_heute: 2, touren_gestern: 3, trend: 'fallend',  trend_delta: -1, ampel: 'gelb',  alert: null,                rang: 3 },
    { fahrer_id: 'f4', fahrer_name: 'Julia F.', touren_heute: 1, touren_gestern: 2, trend: 'fallend',  trend_delta: -1, ampel: 'rot',   alert: 'Zu wenige Touren!', rang: 4 },
  ],
  team_avg_touren: 2.5,
  alert_count: 1,
  generiert_am: new Date().toISOString(),
};

function calcAmpel(touren: number): Ampel {
  if (touren >= 3) return 'gruen';
  if (touren === 2) return 'gelb';
  return 'rot';
}

function calcTrend(heute: number, gestern: number | null): { trend: Trend; delta: number } {
  if (gestern === null) return { trend: 'stabil', delta: 0 };
  const delta = heute - gestern;
  if (delta > 0) return { trend: 'steigend', delta };
  if (delta < 0) return { trend: 'fallend',  delta };
  return { trend: 'stabil', delta: 0 };
}

type StoppRow = {
  driver_id: string;
  batch_id: string;
};

function aggregateTouren(stopps: StoppRow[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const s of stopps) {
    if (!s.driver_id || !s.batch_id) continue;
    if (!map.has(s.driver_id)) map.set(s.driver_id, new Set());
    map.get(s.driver_id)!.add(s.batch_id);
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
        .from('batch_stops')
        .select('driver_id, batch_id')
        .eq('location_id', locationId)
        .eq('status', 'delivered')
        .gte('delivered_at', `${dateStr}T00:00:00Z`)
        .lt('delivered_at',  `${dateStr}T23:59:59Z`);
      if (driverId) q.eq('driver_id', driverId);
      return q;
    };

    const { data: todayStopps } = await buildQ(todayStr);
    const { data: yStopps     } = await buildQ(yStr);

    if (!todayStopps?.length) return NextResponse.json(MOCK);

    const todayMap = aggregateTouren(todayStopps as StoppRow[]);
    const yMap     = aggregateTouren((yStopps ?? []) as StoppRow[]);

    if (todayMap.size === 0) return NextResponse.json(MOCK);

    const driverIds = [...todayMap.keys()];
    const { data: driversRaw } = await sb
      .from('delivery_drivers')
      .select('id, name')
      .in('id', driverIds);

    const nameMap = Object.fromEntries(
      (driversRaw ?? []).map((d: { id: string; name: string }) => [d.id, d.name])
    );

    const fahrer: FahrerTouren[] = driverIds.map((dId, idx) => {
      const tourenHeute   = todayMap.get(dId)?.size ?? 0;
      const tourenGestern = yMap.has(dId) ? (yMap.get(dId)?.size ?? null) : null;
      const ampel         = calcAmpel(tourenHeute);
      const { trend, delta } = calcTrend(tourenHeute, tourenGestern);

      return {
        fahrer_id:      dId,
        fahrer_name:    nameMap[dId] ?? `Fahrer ${idx + 1}`,
        touren_heute:   tourenHeute,
        touren_gestern: tourenGestern,
        trend,
        trend_delta:    delta,
        ampel,
        alert:          tourenHeute < 2 ? 'Zu wenige Touren!' : null,
        rang:           idx + 1,
      };
    });

    fahrer.sort((a, b) => b.touren_heute - a.touren_heute);
    fahrer.forEach((f, i) => { f.rang = i + 1; });

    const teamAvg = fahrer.length > 0
      ? Math.round((fahrer.reduce((s, f) => s + f.touren_heute, 0) / fahrer.length) * 10) / 10
      : 0;

    return NextResponse.json({
      location_id: locationId,
      fahrer,
      team_avg_touren: teamAvg,
      alert_count: fahrer.filter(f => f.alert !== null).length,
      generiert_am: new Date().toISOString(),
    } satisfies ResponseData);
  } catch {
    return NextResponse.json(MOCK);
  }
}
