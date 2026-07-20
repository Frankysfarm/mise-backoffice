/**
 * GET /api/delivery/admin/fahrer-leerfahrten?location_id=<uuid>[&driver_id=<uuid>]
 *
 * Phase 2721 — Fahrer-Leerfahrten-Quote Backend
 *
 * Leerfahrten-Quote je Fahrer heute (stornierte/leere Touren / Gesamt-Touren × 100%).
 * Ampel: grün(<10%) / gelb(10–25%) / rot(>25%).
 * Alert >25%: "Zu viele Leerfahrten!"
 * Trend vs. gestern. Multi-Tenant; Supabase(delivery_batches)+Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';
type Trend = 'steigend' | 'fallend' | 'stabil';

interface FahrerLeerfahrten {
  fahrer_id: string;
  fahrer_name: string;
  quote_pct: number;
  leerfahrten_heute: number;
  touren_heute: number;
  quote_gestern: number | null;
  trend: Trend;
  trend_delta: number;
  ampel: Ampel;
  alert: string | null;
}

interface ResponseData {
  location_id: string;
  fahrer: FahrerLeerfahrten[];
  team_avg_pct: number;
  alert_count: number;
  generiert_am: string;
}

const MOCK: ResponseData = {
  location_id: 'mock',
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   quote_pct:  5.0, leerfahrten_heute: 1, touren_heute: 20, quote_gestern:  7.0, trend: 'fallend',  trend_delta: -2.0, ampel: 'gruen', alert: null                    },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  quote_pct: 15.0, leerfahrten_heute: 2, touren_heute: 13, quote_gestern: 12.0, trend: 'steigend', trend_delta:  3.0, ampel: 'gelb',  alert: null                    },
    { fahrer_id: 'f3', fahrer_name: 'Tim B.',   quote_pct: 22.0, leerfahrten_heute: 3, touren_heute: 14, quote_gestern: 20.0, trend: 'steigend', trend_delta:  2.0, ampel: 'gelb',  alert: null                    },
    { fahrer_id: 'f4', fahrer_name: 'Julia F.', quote_pct: 31.0, leerfahrten_heute: 4, touren_heute: 13, quote_gestern: 18.0, trend: 'steigend', trend_delta: 13.0, ampel: 'rot',   alert: 'Zu viele Leerfahrten!' },
  ],
  team_avg_pct: 18.25,
  alert_count: 1,
  generiert_am: new Date().toISOString(),
};

function calcAmpel(pct: number): Ampel {
  if (pct < 10) return 'gruen';
  if (pct <= 25) return 'gelb';
  return 'rot';
}

function calcTrend(heute: number, gestern: number | null): { trend: Trend; delta: number } {
  if (gestern === null) return { trend: 'stabil', delta: 0 };
  const delta = Math.round((heute - gestern) * 10) / 10;
  if (delta > 2)  return { trend: 'steigend', delta };
  if (delta < -2) return { trend: 'fallend',  delta };
  return { trend: 'stabil', delta };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const driverId   = searchParams.get('driver_id');

  if (!locationId) return NextResponse.json(MOCK);

  try {
    const sb = createServiceClient();
    const today     = new Date(); today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const todayStr     = today.toISOString();
    const yesterdayStr = yesterday.toISOString();
    const tomorrowStr  = new Date(today.getTime() + 86_400_000).toISOString();

    const ALL_STATES = ['delivered', 'completed', 'cancelled', 'failed', 'in_progress', 'assigned'];
    const EMPTY_STATES = ['cancelled', 'failed'];

    const todayQ = sb
      .from('delivery_batches')
      .select('id, driver_id, state, created_at')
      .eq('location_id', locationId)
      .in('state', ALL_STATES)
      .gte('created_at', todayStr)
      .lt('created_at', tomorrowStr);
    if (driverId) todayQ.eq('driver_id', driverId);
    const { data: batchesToday } = await todayQ;

    if (!batchesToday?.length) return NextResponse.json(MOCK);

    const yesterdayQ = sb
      .from('delivery_batches')
      .select('id, driver_id, state, created_at')
      .eq('location_id', locationId)
      .in('state', ALL_STATES)
      .gte('created_at', yesterdayStr)
      .lt('created_at', todayStr);
    if (driverId) yesterdayQ.eq('driver_id', driverId);
    const { data: batchesYesterday } = await yesterdayQ;

    type BatchRow = { id: string; driver_id: string; state: string; created_at: string };
    const batchList = batchesToday as BatchRow[];
    const yesterdayList = (batchesYesterday ?? []) as BatchRow[];

    const driverIds: string[] = [...new Set(batchList.map(b => b.driver_id))];
    const { data: driversRaw } = await sb
      .from('delivery_drivers')
      .select('id, name')
      .in('id', driverIds);

    const nameMap = Object.fromEntries(
      (driversRaw ?? []).map((d: { id: string; name: string }) => [d.id, d.name])
    );

    function driverQuote(
      batches: BatchRow[],
      dId: string
    ): { total: number; leer: number; pct: number } {
      const mine  = batches.filter(b => b.driver_id === dId);
      const leer  = mine.filter(b => EMPTY_STATES.includes(b.state)).length;
      const total = mine.length;
      const pct   = total > 0 ? Math.round((leer / total) * 1000) / 10 : 0;
      return { total, leer, pct };
    }

    const fahrer: FahrerLeerfahrten[] = driverIds.map((dId: string) => {
      const { total, leer, pct }   = driverQuote(batchList, dId);
      const { pct: pctGest }       = driverQuote(yesterdayList, dId);
      const ampel    = calcAmpel(pct);
      const hasYesterday = yesterdayList.some(b => b.driver_id === dId);
      const { trend, delta } = calcTrend(pct, hasYesterday ? pctGest : null);

      return {
        fahrer_id:        dId,
        fahrer_name:      nameMap[dId] ?? `Fahrer ${dId.slice(0, 4)}`,
        quote_pct:        pct,
        leerfahrten_heute: leer,
        touren_heute:     total,
        quote_gestern:    hasYesterday ? pctGest : null,
        trend,
        trend_delta:      delta,
        ampel,
        alert: ampel === 'rot' ? 'Zu viele Leerfahrten!' : null,
      };
    }).sort((a, b) => b.quote_pct - a.quote_pct);

    const team_avg_pct = fahrer.length
      ? Math.round((fahrer.reduce((s, f) => s + f.quote_pct, 0) / fahrer.length) * 10) / 10
      : 0;

    return NextResponse.json({
      location_id: locationId,
      fahrer,
      team_avg_pct,
      alert_count: fahrer.filter(f => f.alert).length,
      generiert_am: new Date().toISOString(),
    } as ResponseData);
  } catch {
    return NextResponse.json(MOCK);
  }
}
