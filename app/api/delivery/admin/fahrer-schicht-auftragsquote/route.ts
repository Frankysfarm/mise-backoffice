/**
 * GET /api/delivery/admin/fahrer-schicht-auftragsquote?location_id=<uuid>[&driver_id=<uuid>]
 *
 * Phase 2706 — Fahrer-Schicht-Auftragsquote Backend
 *
 * Lieferungen/Schichtstunde je Fahrer heute.
 * Ampel: grün(≥3) / gelb(1.5–2.99) / rot(<1.5).
 * Alert <1.5: "Auftragsquote zu niedrig!"
 * Trend vs. gestern.
 * Multi-Tenant; Supabase(delivery_batches + driver_shifts) + Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';
type Trend = 'steigend' | 'fallend' | 'stabil';

interface FahrerQuote {
  fahrer_id: string;
  fahrer_name: string;
  quote: number;
  touren_heute: number;
  schicht_stunden: number;
  quote_gestern: number | null;
  trend: Trend;
  trend_delta: number;
  ampel: Ampel;
  alert: string | null;
  rang: number;
}

interface ResponseData {
  location_id: string;
  fahrer: FahrerQuote[];
  team_avg_quote: number;
  alert_count: number;
  generiert_am: string;
}

const MOCK: ResponseData = {
  location_id: 'mock',
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   quote: 4.2, touren_heute: 13, schicht_stunden: 3.1, quote_gestern: 3.8, trend: 'steigend', trend_delta:  0.4, ampel: 'gruen', alert: null,                           rang: 1 },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  quote: 3.1, touren_heute:  9, schicht_stunden: 2.9, quote_gestern: 3.5, trend: 'fallend',  trend_delta: -0.4, ampel: 'gruen', alert: null,                           rang: 2 },
    { fahrer_id: 'f3', fahrer_name: 'Tim B.',   quote: 2.0, touren_heute:  6, schicht_stunden: 3.0, quote_gestern: 2.1, trend: 'stabil',   trend_delta: -0.1, ampel: 'gelb',  alert: null,                           rang: 3 },
    { fahrer_id: 'f4', fahrer_name: 'Julia F.', quote: 1.2, touren_heute:  4, schicht_stunden: 3.3, quote_gestern: 1.8, trend: 'fallend',  trend_delta: -0.6, ampel: 'rot',   alert: 'Auftragsquote zu niedrig!', rang: 4 },
  ],
  team_avg_quote: 2.6,
  alert_count: 1,
  generiert_am: new Date().toISOString(),
};

function calcAmpel(q: number): Ampel {
  if (q >= 3)   return 'gruen';
  if (q >= 1.5) return 'gelb';
  return 'rot';
}

function calcTrend(heute: number, gestern: number | null): { trend: Trend; delta: number } {
  if (gestern === null || gestern === 0) return { trend: 'stabil', delta: 0 };
  const delta = Math.round((heute - gestern) * 10) / 10;
  if (delta >  0.2) return { trend: 'steigend', delta };
  if (delta < -0.2) return { trend: 'fallend',  delta };
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

    const shiftsQ = sb
      .from('driver_shifts')
      .select('driver_id, planned_start, planned_end, actual_start, actual_end')
      .eq('location_id', locationId)
      .gte('planned_start', todayStr)
      .lt('planned_start', tomorrowStr);
    if (driverId) shiftsQ.eq('driver_id', driverId);
    const { data: shiftsRaw } = await shiftsQ;
    if (!shiftsRaw?.length) return NextResponse.json(MOCK);

    const { data: batchesToday } = await sb
      .from('delivery_batches')
      .select('driver_id, state, created_at')
      .eq('location_id', locationId)
      .in('state', ['delivered', 'completed'])
      .gte('created_at', todayStr)
      .lt('created_at', tomorrowStr);

    const { data: batchesYesterday } = await sb
      .from('delivery_batches')
      .select('driver_id, state, created_at')
      .eq('location_id', locationId)
      .in('state', ['delivered', 'completed'])
      .gte('created_at', yesterdayStr)
      .lt('created_at', todayStr);

    const driverIds = [...new Set(shiftsRaw.map((s: {driver_id: string}) => s.driver_id))];
    const { data: driversRaw } = await sb
      .from('delivery_drivers')
      .select('id, name')
      .in('id', driverIds);

    const nameMap = Object.fromEntries(
      (driversRaw ?? []).map((d: {id: string; name: string}) => [d.id, d.name])
    );

    function countBatches(batches: {driver_id: string}[] | null, dId: string) {
      return (batches ?? []).filter(b => b.driver_id === dId).length;
    }

    function shiftHours(shifts: {driver_id: string; actual_start?: string | null; actual_end?: string | null; planned_start: string}[], dId: string) {
      const s = shifts.find(sh => sh.driver_id === dId);
      if (!s) return 0;
      const start = new Date(s.actual_start ?? s.planned_start);
      const end   = s.actual_end ? new Date(s.actual_end as string) : new Date();
      return Math.max(0, Math.round((end.getTime() - start.getTime()) / 360_000) / 10);
    }

    const fahrer: FahrerQuote[] = driverIds.map((dId, idx) => {
      const touren   = countBatches(batchesToday   as {driver_id: string}[], dId);
      const tourGest = countBatches(batchesYesterday as {driver_id: string}[], dId);
      const stunden  = shiftHours(shiftsRaw as {driver_id: string; actual_start?: string | null; actual_end?: string | null; planned_start: string}[], dId);
      const quote    = stunden > 0 ? Math.round((touren / stunden) * 10) / 10 : 0;
      const quotGest = stunden > 0 && tourGest > 0 ? Math.round((tourGest / stunden) * 10) / 10 : null;
      const ampel    = calcAmpel(quote);
      const { trend, delta } = calcTrend(quote, quotGest);

      return {
        fahrer_id:       dId,
        fahrer_name:     nameMap[dId] ?? `Fahrer ${idx + 1}`,
        quote,
        touren_heute:    touren,
        schicht_stunden: stunden,
        quote_gestern:   quotGest,
        trend,
        trend_delta:     delta,
        ampel,
        alert: ampel === 'rot' ? 'Auftragsquote zu niedrig!' : null,
        rang:  idx + 1,
      };
    }).sort((a, b) => b.quote - a.quote).map((f, i) => ({ ...f, rang: i + 1 }));

    return NextResponse.json({
      location_id: locationId,
      fahrer,
      team_avg_quote: fahrer.length
        ? Math.round((fahrer.reduce((s, f) => s + f.quote, 0) / fahrer.length) * 10) / 10
        : 0,
      alert_count:   fahrer.filter(f => f.alert).length,
      generiert_am:  new Date().toISOString(),
    } as ResponseData);
  } catch {
    return NextResponse.json(MOCK);
  }
}
