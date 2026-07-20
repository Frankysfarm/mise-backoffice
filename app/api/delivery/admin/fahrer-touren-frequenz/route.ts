/**
 * GET /api/delivery/admin/fahrer-touren-frequenz?location_id=<uuid>[&driver_id=<uuid>]
 *
 * Phase 2726 — Fahrer-Touren-Frequenz Backend
 *
 * Touren pro Stunde je Fahrer heute (Touren-Count / aktive Schicht-Stunden).
 * Ampel: grün(≥1.5/h) / gelb(1.0–1.49/h) / rot(<1.0/h).
 * Alert <1.0/h: "Frequenz zu niedrig!"
 * Trend vs. gestern. Multi-Tenant; Supabase(delivery_batches + driver_shifts) + Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';
type Trend = 'steigend' | 'fallend' | 'stabil';

interface FahrerFrequenz {
  fahrer_id: string;
  fahrer_name: string;
  frequenz: number;
  touren_heute: number;
  schicht_stunden: number;
  frequenz_gestern: number | null;
  trend: Trend;
  trend_delta: number;
  ampel: Ampel;
  alert: string | null;
  rang: number;
}

interface ResponseData {
  location_id: string;
  fahrer: FahrerFrequenz[];
  team_avg_frequenz: number;
  alert_count: number;
  generiert_am: string;
}

const MOCK: ResponseData = {
  location_id: 'mock',
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   frequenz: 2.1, touren_heute: 7, schicht_stunden: 3.3, frequenz_gestern: 1.9, trend: 'steigend', trend_delta:  0.2, ampel: 'gruen', alert: null,                   rang: 1 },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  frequenz: 1.5, touren_heute: 5, schicht_stunden: 3.3, frequenz_gestern: 1.6, trend: 'stabil',   trend_delta: -0.1, ampel: 'gruen', alert: null,                   rang: 2 },
    { fahrer_id: 'f3', fahrer_name: 'Tim B.',   frequenz: 1.2, touren_heute: 4, schicht_stunden: 3.3, frequenz_gestern: 1.3, trend: 'stabil',   trend_delta: -0.1, ampel: 'gelb',  alert: null,                   rang: 3 },
    { fahrer_id: 'f4', fahrer_name: 'Julia F.', frequenz: 0.8, touren_heute: 3, schicht_stunden: 3.8, frequenz_gestern: 1.1, trend: 'fallend',  trend_delta: -0.3, ampel: 'rot',   alert: 'Frequenz zu niedrig!', rang: 4 },
  ],
  team_avg_frequenz: 1.4,
  alert_count: 1,
  generiert_am: new Date().toISOString(),
};

function calcAmpel(freq: number): Ampel {
  if (freq >= 1.5) return 'gruen';
  if (freq >= 1.0) return 'gelb';
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

    const batchQ = sb
      .from('delivery_batches')
      .select('driver_id, state, created_at')
      .eq('location_id', locationId)
      .in('state', ['delivered', 'completed'])
      .gte('created_at', todayStr)
      .lt('created_at', tomorrowStr);
    if (driverId) batchQ.eq('driver_id', driverId);
    const { data: batchesToday } = await batchQ;

    const batchQYest = sb
      .from('delivery_batches')
      .select('driver_id, state, created_at')
      .eq('location_id', locationId)
      .in('state', ['delivered', 'completed'])
      .gte('created_at', yesterdayStr)
      .lt('created_at', todayStr);
    if (driverId) batchQYest.eq('driver_id', driverId);
    const { data: batchesYesterday } = await batchQYest;

    type ShiftRow = { driver_id: string; planned_start: string; actual_start?: string | null; actual_end?: string | null };
    type BatchRow = { driver_id: string };

    const driverIds = [...new Set((shiftsRaw as ShiftRow[]).map(s => s.driver_id))];
    const { data: driversRaw } = await sb
      .from('delivery_drivers')
      .select('id, name')
      .in('id', driverIds);

    const nameMap = Object.fromEntries(
      (driversRaw ?? []).map((d: { id: string; name: string }) => [d.id, d.name])
    );

    function countBatches(batches: BatchRow[] | null, dId: string): number {
      return (batches ?? []).filter(b => b.driver_id === dId).length;
    }

    function shiftHours(shifts: ShiftRow[], dId: string): number {
      const s = shifts.find(sh => sh.driver_id === dId);
      if (!s) return 0;
      const start = new Date(s.actual_start ?? s.planned_start);
      const end   = s.actual_end ? new Date(s.actual_end) : new Date();
      return Math.max(0, Math.round((end.getTime() - start.getTime()) / 360_000) / 10);
    }

    const fahrer: FahrerFrequenz[] = driverIds.map((dId, idx) => {
      const touren   = countBatches(batchesToday   as BatchRow[], dId);
      const tourGest = countBatches(batchesYesterday as BatchRow[], dId);
      const stunden  = shiftHours(shiftsRaw as ShiftRow[], dId);
      const frequenz = stunden > 0 ? Math.round((touren / stunden) * 10) / 10 : 0;
      const freqGest = stunden > 0 && tourGest > 0
        ? Math.round((tourGest / stunden) * 10) / 10
        : null;
      const ampel = calcAmpel(frequenz);
      const { trend, delta } = calcTrend(frequenz, freqGest);

      return {
        fahrer_id:        dId,
        fahrer_name:      nameMap[dId] ?? `Fahrer ${idx + 1}`,
        frequenz,
        touren_heute:     touren,
        schicht_stunden:  stunden,
        frequenz_gestern: freqGest,
        trend,
        trend_delta:      delta,
        ampel,
        alert: ampel === 'rot' ? 'Frequenz zu niedrig!' : null,
        rang:  idx + 1,
      };
    }).sort((a, b) => b.frequenz - a.frequenz).map((f, i) => ({ ...f, rang: i + 1 }));

    return NextResponse.json({
      location_id: locationId,
      fahrer,
      team_avg_frequenz: fahrer.length
        ? Math.round((fahrer.reduce((s, f) => s + f.frequenz, 0) / fahrer.length) * 10) / 10
        : 0,
      alert_count:  fahrer.filter(f => f.alert).length,
      generiert_am: new Date().toISOString(),
    } as ResponseData);
  } catch {
    return NextResponse.json(MOCK);
  }
}
