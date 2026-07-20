/**
 * GET /api/delivery/admin/fahrer-rueckkehr-zuverlaessigkeit?location_id=<uuid>[&driver_id=<uuid>]
 *
 * Phase 2731 — Fahrer-Rückkehr-Zuverlässigkeit Backend
 *
 * Pünktlichkeitsrate Schichtende je Fahrer (planned_end vs. actual_end in driver_shifts,
 * letzte 7 Tage). Pünktlich = actual_end ≤ planned_end + 15 Min.
 * Ampel: grün(≥90%) / gelb(70–89%) / rot(<70%).
 * Alert <70%: "Rückkehr unzuverlässig!"
 * Trend vs. 7-Tage-Periode davor. Multi-Tenant; Supabase(driver_shifts) + Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const PUENKTLICH_PUFFER_MS = 15 * 60 * 1000; // 15 Minuten Toleranz

type Ampel = 'gruen' | 'gelb' | 'rot';
type Trend = 'steigend' | 'fallend' | 'stabil';

interface FahrerZuverlaessigkeit {
  fahrer_id: string;
  fahrer_name: string;
  rate: number;
  puenktlich: number;
  gesamt: number;
  rate_gestern: number | null;
  trend: Trend;
  trend_delta: number;
  ampel: Ampel;
  alert: string | null;
  rang: number;
}

interface ResponseData {
  location_id: string;
  fahrer: FahrerZuverlaessigkeit[];
  team_avg_rate: number;
  alert_count: number;
  generiert_am: string;
}

const MOCK: ResponseData = {
  location_id: 'mock',
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   rate: 95, puenktlich: 19, gesamt: 20, rate_gestern: 90, trend: 'steigend', trend_delta:  5, ampel: 'gruen', alert: null,                      rang: 1 },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rate: 80, puenktlich: 16, gesamt: 20, rate_gestern: 80, trend: 'stabil',   trend_delta:  0, ampel: 'gelb',  alert: null,                      rang: 2 },
    { fahrer_id: 'f3', fahrer_name: 'Tim B.',   rate: 75, puenktlich: 15, gesamt: 20, rate_gestern: 78, trend: 'fallend',  trend_delta: -3, ampel: 'gelb',  alert: null,                      rang: 3 },
    { fahrer_id: 'f4', fahrer_name: 'Julia F.', rate: 60, puenktlich: 12, gesamt: 20, rate_gestern: 65, trend: 'fallend',  trend_delta: -5, ampel: 'rot',   alert: 'Rückkehr unzuverlässig!', rang: 4 },
  ],
  team_avg_rate: 77.5,
  alert_count: 1,
  generiert_am: new Date().toISOString(),
};

function calcAmpel(rate: number): Ampel {
  if (rate >= 90) return 'gruen';
  if (rate >= 70) return 'gelb';
  return 'rot';
}

function calcTrend(heute: number, gestern: number | null): { trend: Trend; delta: number } {
  if (gestern === null) return { trend: 'stabil', delta: 0 };
  const delta = Math.round((heute - gestern) * 10) / 10;
  if (delta >  2) return { trend: 'steigend', delta };
  if (delta < -2) return { trend: 'fallend',  delta };
  return { trend: 'stabil', delta };
}

type ShiftRow = {
  driver_id: string;
  planned_end: string;
  actual_end: string | null;
};

function calcRate(shifts: ShiftRow[], dId: string): { rate: number; puenktlich: number; gesamt: number } {
  const myShifts = shifts.filter(s => s.driver_id === dId && s.actual_end !== null);
  if (!myShifts.length) return { rate: 0, puenktlich: 0, gesamt: 0 };
  const puenktlich = myShifts.filter(s => {
    const planned = new Date(s.planned_end).getTime();
    const actual  = new Date(s.actual_end!).getTime();
    return actual <= planned + PUENKTLICH_PUFFER_MS;
  }).length;
  return {
    rate:       Math.round((puenktlich / myShifts.length) * 100),
    puenktlich,
    gesamt:     myShifts.length,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const driverId   = searchParams.get('driver_id');

  if (!locationId) return NextResponse.json(MOCK);

  try {
    const sb = createServiceClient();
    const now       = new Date();
    const day7ago   = new Date(now.getTime() - 7  * 86_400_000);
    const day14ago  = new Date(now.getTime() - 14 * 86_400_000);

    const buildQ = (from: Date, to: Date) => {
      const q = sb
        .from('driver_shifts')
        .select('driver_id, planned_end, actual_end')
        .eq('location_id', locationId)
        .gte('planned_end', from.toISOString())
        .lt('planned_end', to.toISOString())
        .not('actual_end', 'is', null);
      if (driverId) q.eq('driver_id', driverId);
      return q;
    };

    const { data: shiftsNow  } = await buildQ(day7ago,  now);
    const { data: shiftsPrev } = await buildQ(day14ago, day7ago);

    if (!shiftsNow?.length) return NextResponse.json(MOCK);

    const driverIds = [...new Set((shiftsNow as ShiftRow[]).map(s => s.driver_id))];
    const { data: driversRaw } = await sb
      .from('delivery_drivers')
      .select('id, name')
      .in('id', driverIds);

    const nameMap = Object.fromEntries(
      (driversRaw ?? []).map((d: { id: string; name: string }) => [d.id, d.name])
    );

    const fahrer: FahrerZuverlaessigkeit[] = driverIds.map((dId, idx) => {
      const cur  = calcRate(shiftsNow  as ShiftRow[], dId);
      const prev = calcRate(shiftsPrev as ShiftRow[], dId);
      const ampel = calcAmpel(cur.rate);
      const { trend, delta } = calcTrend(cur.rate, prev.gesamt > 0 ? prev.rate : null);

      return {
        fahrer_id:    dId,
        fahrer_name:  nameMap[dId] ?? `Fahrer ${idx + 1}`,
        rate:         cur.rate,
        puenktlich:   cur.puenktlich,
        gesamt:       cur.gesamt,
        rate_gestern: prev.gesamt > 0 ? prev.rate : null,
        trend,
        trend_delta:  delta,
        ampel,
        alert: ampel === 'rot' ? 'Rückkehr unzuverlässig!' : null,
        rang:  idx + 1,
      };
    }).sort((a, b) => b.rate - a.rate).map((f, i) => ({ ...f, rang: i + 1 }));

    return NextResponse.json({
      location_id: locationId,
      fahrer,
      team_avg_rate: fahrer.length
        ? Math.round((fahrer.reduce((s, f) => s + f.rate, 0) / fahrer.length) * 10) / 10
        : 0,
      alert_count:  fahrer.filter(f => f.alert).length,
      generiert_am: new Date().toISOString(),
    } as ResponseData);
  } catch {
    return NextResponse.json(MOCK);
  }
}
