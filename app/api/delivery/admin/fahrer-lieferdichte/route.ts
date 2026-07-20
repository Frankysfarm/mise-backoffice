/**
 * GET /api/delivery/admin/fahrer-lieferdichte?location_id=<uuid>[&driver_id=<uuid>]
 *
 * Phase 2711 — Fahrer-Lieferdichteanalyse Backend
 *
 * Stopps/km je Fahrer heute (Effizienz der Routenplanung).
 * Ampel: grün(≥0.3) / gelb(0.15–0.29) / rot(<0.15).
 * Alert <0.15: "Lieferdichte zu gering!"
 * Trend vs. gestern.
 * Multi-Tenant; Supabase(delivery_batches + batch_stops) + Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';
type Trend = 'steigend' | 'fallend' | 'stabil';

interface FahrerDichte {
  fahrer_id: string;
  fahrer_name: string;
  dichte: number;
  stopps_heute: number;
  km_heute: number;
  dichte_gestern: number | null;
  trend: Trend;
  trend_delta: number;
  ampel: Ampel;
  alert: string | null;
}

interface ResponseData {
  location_id: string;
  fahrer: FahrerDichte[];
  team_avg_dichte: number;
  alert_count: number;
  generiert_am: string;
}

const MOCK: ResponseData = {
  location_id: 'mock',
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   dichte: 0.42, stopps_heute: 13, km_heute: 31.0, dichte_gestern: 0.38, trend: 'steigend', trend_delta:  0.04, ampel: 'gruen', alert: null                       },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  dichte: 0.31, stopps_heute:  9, km_heute: 29.0, dichte_gestern: 0.35, trend: 'fallend',  trend_delta: -0.04, ampel: 'gruen', alert: null                       },
    { fahrer_id: 'f3', fahrer_name: 'Tim B.',   dichte: 0.21, stopps_heute:  6, km_heute: 28.6, dichte_gestern: 0.20, trend: 'stabil',   trend_delta:  0.01, ampel: 'gelb',  alert: null                       },
    { fahrer_id: 'f4', fahrer_name: 'Julia F.', dichte: 0.11, stopps_heute:  4, km_heute: 36.4, dichte_gestern: 0.18, trend: 'fallend',  trend_delta: -0.07, ampel: 'rot',   alert: 'Lieferdichte zu gering!' },
  ],
  team_avg_dichte: 0.26,
  alert_count: 1,
  generiert_am: new Date().toISOString(),
};

function calcAmpel(d: number): Ampel {
  if (d >= 0.3)  return 'gruen';
  if (d >= 0.15) return 'gelb';
  return 'rot';
}

function calcTrend(heute: number, gestern: number | null): { trend: Trend; delta: number } {
  if (gestern === null || gestern === 0) return { trend: 'stabil', delta: 0 };
  const delta = Math.round((heute - gestern) * 1000) / 1000;
  if (delta >  0.02) return { trend: 'steigend', delta };
  if (delta < -0.02) return { trend: 'fallend',  delta };
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

    const batchesQ = sb
      .from('delivery_batches')
      .select('id, driver_id, total_distance_km, state, created_at')
      .eq('location_id', locationId)
      .in('state', ['delivered', 'completed'])
      .gte('created_at', todayStr)
      .lt('created_at', tomorrowStr);
    if (driverId) batchesQ.eq('driver_id', driverId);
    const { data: batchesToday } = await batchesQ;

    if (!batchesToday?.length) return NextResponse.json(MOCK);

    const batchIdsToday = batchesToday.map((b: { id: string }) => b.id);

    const { data: stopsToday } = await sb
      .from('batch_stops')
      .select('batch_id')
      .in('batch_id', batchIdsToday);

    const batchesYestQ = sb
      .from('delivery_batches')
      .select('id, driver_id, total_distance_km, state, created_at')
      .eq('location_id', locationId)
      .in('state', ['delivered', 'completed'])
      .gte('created_at', yesterdayStr)
      .lt('created_at', todayStr);
    if (driverId) batchesYestQ.eq('driver_id', driverId);
    const { data: batchesYesterday } = await batchesYestQ;

    const batchIdsYest = (batchesYesterday ?? []).map((b: { id: string }) => b.id);
    const { data: stopsYesterday } = batchIdsYest.length
      ? await sb.from('batch_stops').select('batch_id').in('batch_id', batchIdsYest)
      : { data: [] };

    const driverIds = [...new Set(batchesToday.map((b: { driver_id: string }) => b.driver_id))];
    const { data: driversRaw } = await sb
      .from('delivery_drivers')
      .select('id, name')
      .in('id', driverIds);

    const nameMap = Object.fromEntries(
      (driversRaw ?? []).map((d: { id: string; name: string }) => [d.id, d.name])
    );

    function driverStats(
      batches: { id: string; driver_id: string; total_distance_km?: number | null }[],
      stops: { batch_id: string }[] | null,
      dId: string
    ) {
      const dBatches = batches.filter(b => b.driver_id === dId);
      const bIds = new Set(dBatches.map(b => b.id));
      const stopCount = (stops ?? []).filter(s => bIds.has(s.batch_id)).length;
      const km = dBatches.reduce((s, b) => s + (b.total_distance_km ?? 0), 0);
      return { stopCount, km: Math.round(km * 10) / 10 };
    }

    const fahrer: FahrerDichte[] = driverIds.map(dId => {
      const { stopCount, km } = driverStats(
        batchesToday as { id: string; driver_id: string; total_distance_km?: number | null }[],
        stopsToday as { batch_id: string }[] | null,
        dId
      );
      const { stopCount: stopGest, km: kmGest } = driverStats(
        (batchesYesterday ?? []) as { id: string; driver_id: string; total_distance_km?: number | null }[],
        stopsYesterday as { batch_id: string }[] | null,
        dId
      );

      const dichte     = km > 0 ? Math.round((stopCount / km) * 1000) / 1000 : 0;
      const dichteGest = kmGest > 0 ? Math.round((stopGest / kmGest) * 1000) / 1000 : null;
      const ampel      = calcAmpel(dichte);
      const { trend, delta } = calcTrend(dichte, dichteGest);

      return {
        fahrer_id:      dId,
        fahrer_name:    nameMap[dId] ?? `Fahrer ${dId.slice(0, 4)}`,
        dichte,
        stopps_heute:   stopCount,
        km_heute:       km,
        dichte_gestern: dichteGest,
        trend,
        trend_delta:    delta,
        ampel,
        alert: ampel === 'rot' ? 'Lieferdichte zu gering!' : null,
      };
    }).sort((a, b) => b.dichte - a.dichte);

    return NextResponse.json({
      location_id: locationId,
      fahrer,
      team_avg_dichte: fahrer.length
        ? Math.round((fahrer.reduce((s, f) => s + f.dichte, 0) / fahrer.length) * 1000) / 1000
        : 0,
      alert_count:   fahrer.filter(f => f.alert).length,
      generiert_am:  new Date().toISOString(),
    } as ResponseData);
  } catch {
    return NextResponse.json(MOCK);
  }
}
