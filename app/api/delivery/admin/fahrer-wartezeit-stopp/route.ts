/**
 * GET /api/delivery/admin/fahrer-wartezeit-stopp?location_id=<uuid>[&driver_id=<uuid>]
 *
 * Phase 2741 — Fahrer-Wartezeit-am-Stopp Backend
 *
 * Ø Wartezeit je Stopp je Fahrer heute (stop_arrived_at → stop_completed_at).
 * Ampel: grün(≤3 Min) / gelb(3–6 Min) / rot(>6 Min).
 * Alert >6 Min: "Zu lange Wartezeit!"
 * Trend vs. gestern. Multi-Tenant; Supabase(batch_stops) + Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';
type Trend = 'steigend' | 'fallend' | 'stabil';

interface FahrerWartezeit {
  fahrer_id: string;
  fahrer_name: string;
  avg_wartezeit_min: number;
  stopps: number;
  avg_wartezeit_gestern: number | null;
  trend: Trend;
  trend_delta: number;
  ampel: Ampel;
  alert: string | null;
  rang: number;
}

interface ResponseData {
  location_id: string;
  fahrer: FahrerWartezeit[];
  team_avg_wartezeit_min: number;
  alert_count: number;
  generiert_am: string;
}

const MOCK: ResponseData = {
  location_id: 'mock',
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   avg_wartezeit_min: 2.1, stopps: 10, avg_wartezeit_gestern: 2.4, trend: 'fallend',  trend_delta: -0.3, ampel: 'gruen', alert: null,                   rang: 1 },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  avg_wartezeit_min: 4.3, stopps:  8, avg_wartezeit_gestern: 4.0, trend: 'steigend', trend_delta:  0.3, ampel: 'gelb',  alert: null,                   rang: 2 },
    { fahrer_id: 'f3', fahrer_name: 'Tim B.',   avg_wartezeit_min: 5.8, stopps:  6, avg_wartezeit_gestern: 5.5, trend: 'steigend', trend_delta:  0.3, ampel: 'gelb',  alert: null,                   rang: 3 },
    { fahrer_id: 'f4', fahrer_name: 'Julia F.', avg_wartezeit_min: 7.5, stopps:  5, avg_wartezeit_gestern: 6.2, trend: 'steigend', trend_delta:  1.3, ampel: 'rot',   alert: 'Zu lange Wartezeit!',  rang: 4 },
  ],
  team_avg_wartezeit_min: 4.9,
  alert_count: 1,
  generiert_am: new Date().toISOString(),
};

function calcAmpel(min: number): Ampel {
  if (min <= 3) return 'gruen';
  if (min <= 6) return 'gelb';
  return 'rot';
}

function calcTrend(heute: number, gestern: number | null): { trend: Trend; delta: number } {
  if (gestern === null) return { trend: 'stabil', delta: 0 };
  const delta = Math.round((heute - gestern) * 10) / 10;
  if (delta >  0.3) return { trend: 'steigend', delta };
  if (delta < -0.3) return { trend: 'fallend',  delta };
  return { trend: 'stabil', delta };
}

type StoppRow = {
  driver_id: string;
  arrived_at: string | null;
  completed_at: string | null;
};

function aggregateStopps(stopps: StoppRow[]): Map<string, { totalMin: number; count: number }> {
  const map = new Map<string, { totalMin: number; count: number }>();
  for (const s of stopps) {
    if (!s.arrived_at || !s.completed_at) continue;
    const diff = (new Date(s.completed_at).getTime() - new Date(s.arrived_at).getTime()) / 60_000;
    if (diff < 0 || diff > 120) continue; // sanity check
    const prev = map.get(s.driver_id) ?? { totalMin: 0, count: 0 };
    map.set(s.driver_id, { totalMin: prev.totalMin + diff, count: prev.count + 1 });
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
        .from('batch_stops')
        .select('driver_id, arrived_at, completed_at')
        .eq('location_id', locationId)
        .gte('arrived_at', `${dateStr}T00:00:00Z`)
        .lt('arrived_at',  `${dateStr}T23:59:59Z`)
        .not('arrived_at', 'is', null)
        .not('completed_at', 'is', null);
      if (driverId) q.eq('driver_id', driverId);
      return q;
    };

    const { data: todayStopps  } = await buildQ(todayStr);
    const { data: yStopps      } = await buildQ(yStr);

    if (!todayStopps?.length) return NextResponse.json(MOCK);

    const todayMap = aggregateStopps(todayStopps as StoppRow[]);
    const yMap     = aggregateStopps((yStopps ?? []) as StoppRow[]);

    if (todayMap.size === 0) return NextResponse.json(MOCK);

    const driverIds = [...todayMap.keys()];
    const { data: driversRaw } = await sb
      .from('delivery_drivers')
      .select('id, name')
      .in('id', driverIds);

    const nameMap = Object.fromEntries(
      (driversRaw ?? []).map((d: { id: string; name: string }) => [d.id, d.name])
    );

    const fahrer: FahrerWartezeit[] = driverIds.map((dId, idx) => {
      const today  = todayMap.get(dId)!;
      const avgMin = today.count > 0
        ? Math.round((today.totalMin / today.count) * 10) / 10
        : 0;
      const yEntry = yMap.get(dId);
      const avgGest = yEntry && yEntry.count > 0
        ? Math.round((yEntry.totalMin / yEntry.count) * 10) / 10
        : null;
      const ampel  = calcAmpel(avgMin);
      const { trend, delta } = calcTrend(avgMin, avgGest);

      return {
        fahrer_id:            dId,
        fahrer_name:          nameMap[dId] ?? `Fahrer ${idx + 1}`,
        avg_wartezeit_min:    avgMin,
        stopps:               today.count,
        avg_wartezeit_gestern: avgGest,
        trend,
        trend_delta:          delta,
        ampel,
        alert:                ampel === 'rot' ? 'Zu lange Wartezeit!' : null,
        rang:                 idx + 1,
      };
    });

    // Aufsteigend nach Wartezeit: niedrigste (beste) zuerst für Rang
    fahrer.sort((a, b) => a.avg_wartezeit_min - b.avg_wartezeit_min);
    fahrer.forEach((f, i) => { f.rang = i + 1; });

    const teamAvg = fahrer.length > 0
      ? Math.round((fahrer.reduce((s, f) => s + f.avg_wartezeit_min, 0) / fahrer.length) * 10) / 10
      : 0;

    return NextResponse.json({
      location_id: locationId,
      fahrer,
      team_avg_wartezeit_min: teamAvg,
      alert_count: fahrer.filter(f => f.alert !== null).length,
      generiert_am: new Date().toISOString(),
    } satisfies ResponseData);
  } catch {
    return NextResponse.json(MOCK);
  }
}
