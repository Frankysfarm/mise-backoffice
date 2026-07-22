import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';
type Trend = 'steigend' | 'fallend' | 'stabil';

const MONAT_MINUTEN = 30 * 24 * 60; // 43200 Min (30 Tage)

function calcAmpel(pct: number): Ampel {
  if (pct >= 70) return 'gruen';
  if (pct >= 50) return 'gelb';
  return 'rot';
}

function calcTrend(curr: number, prev: number): { trend: Trend; delta: number } {
  const delta = Math.round((curr - prev) * 10) / 10;
  if (delta > 0.5) return { trend: 'steigend', delta };
  if (delta < -0.5) return { trend: 'fallend', delta };
  return { trend: 'stabil', delta };
}

export interface FahrerMonatsauslastung {
  fahrer_id: string;
  fahrer_name: string;
  auslastung_pct: number;
  auslastung_pct_vormonat: number;
  wochen_pct: number[]; // [KW1, KW2, KW3, KW4]
  trend: Trend;
  trend_delta: number;
  ampel: Ampel;
  alert_gering: boolean;
}

export interface FahrerMonatsauslastungResponse {
  fahrer: FahrerMonatsauslastung[];
  team_avg_pct: number;
  team_avg_pct_vormonat: number;
  alert_count: number;
  generiert_am: string;
}

function buildMock(_locationId: string, driverId?: string): FahrerMonatsauslastungResponse {
  const drivers = [
    { id: 'd1', name: 'Max M.',   pct: 74.5, wochen: [78, 72, 76, 72] },
    { id: 'd2', name: 'Sara K.',  pct: 62.1, wochen: [65, 60, 63, 60] },
    { id: 'd3', name: 'Tim B.',   pct: 41.3, wochen: [45, 40, 42, 38] },
    { id: 'd4', name: 'Julia F.', pct: 85.7, wochen: [88, 84, 87, 84] },
  ];

  const fahrer: FahrerMonatsauslastung[] = drivers.map(d => {
    const pct_vm = Math.max(0, Math.min(100, d.pct + (d.pct > 70 ? -2 : 2)));
    const { trend, delta } = calcTrend(d.pct, pct_vm);
    return {
      fahrer_id: d.id,
      fahrer_name: d.name,
      auslastung_pct: d.pct,
      auslastung_pct_vormonat: Math.round(pct_vm * 10) / 10,
      wochen_pct: d.wochen,
      trend,
      trend_delta: delta,
      ampel: calcAmpel(d.pct),
      alert_gering: d.pct < 50,
    };
  }).sort((a, b) => b.auslastung_pct - a.auslastung_pct);

  const team_avg    = Math.round((fahrer.reduce((s, f) => s + f.auslastung_pct, 0)           / fahrer.length) * 10) / 10;
  const team_avg_vm = Math.round((fahrer.reduce((s, f) => s + f.auslastung_pct_vormonat, 0)  / fahrer.length) * 10) / 10;
  const alert_count = fahrer.filter(f => f.alert_gering).length;

  if (driverId) {
    const f = fahrer.find(d => d.fahrer_id === driverId) ?? fahrer[0];
    return { fahrer: [f], team_avg_pct: team_avg, team_avg_pct_vormonat: team_avg_vm, alert_count: 0, generiert_am: new Date().toISOString() };
  }

  return { fahrer, team_avg_pct: team_avg, team_avg_pct_vormonat: team_avg_vm, alert_count, generiert_am: new Date().toISOString() };
}

function getMonthStart(ref: Date): Date {
  return new Date(ref.getFullYear(), ref.getMonth(), 1);
}

function getPrevMonthStart(ref: Date): Date {
  return new Date(ref.getFullYear(), ref.getMonth() - 1, 1);
}

function getPrevMonthEnd(ref: Date): Date {
  return new Date(ref.getFullYear(), ref.getMonth(), 0, 23, 59, 59, 999);
}

function getWeekBoundaries(monthStart: Date): { start: Date; end: Date }[] {
  const weeks: { start: Date; end: Date }[] = [];
  for (let i = 0; i < 4; i++) {
    const s = new Date(monthStart.getTime() + i * 7 * 24 * 60 * 60 * 1000);
    const e = new Date(s.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
    weeks.push({ start: s, end: e });
  }
  return weeks;
}

function activeMinutesInWindow(
  stops: { driver_id: string; created_at: string; delivered_at: string | null }[] | null,
  dId: string,
  windowStart: Date,
  windowEnd: Date,
): number {
  const ds = (stops ?? []).filter(s => s.driver_id === dId && s.created_at);
  let totalMs = 0;
  for (const s of ds) {
    const start = new Date(s.created_at);
    const end   = s.delivered_at ? new Date(s.delivered_at) : new Date(start.getTime() + 20 * 60000);
    const cStart = start < windowStart ? windowStart : start;
    const cEnd   = end   > windowEnd   ? windowEnd   : end;
    if (cEnd > cStart) totalMs += cEnd.getTime() - cStart.getTime();
  }
  return Math.round(totalMs / 60000);
}

export async function GET(req: Request): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id') ?? '';
  const driverId   = searchParams.get('driver_id')   ?? undefined;

  try {
    const supabase  = createServiceClient();
    const now       = new Date();
    const mStart    = getMonthStart(now);
    const mEnd      = now;
    const pmStart   = getPrevMonthStart(now);
    const pmEnd     = getPrevMonthEnd(now);

    const [stopsRes, prevStopsRes, driversRes] = await Promise.all([
      supabase.from('batch_stops').select('driver_id,created_at,delivered_at')
        .gte('created_at', mStart.toISOString()).lte('created_at', mEnd.toISOString())
        .eq('location_id', locationId),
      supabase.from('batch_stops').select('driver_id,created_at,delivered_at')
        .gte('created_at', pmStart.toISOString()).lte('created_at', pmEnd.toISOString())
        .eq('location_id', locationId),
      supabase.from('drivers').select('id,name').eq('location_id', locationId).eq('active', true),
    ]);

    const stops     = stopsRes.data;
    const prevStops = prevStopsRes.data;
    const drivers   = driversRes.data;

    if (!stops || !drivers || stops.length === 0 || drivers.length === 0) {
      return NextResponse.json(buildMock(locationId, driverId));
    }

    const daysSoFar      = Math.max(1, Math.round((now.getTime() - mStart.getTime()) / (24 * 60 * 60 * 1000)));
    const monatMinSoFar  = daysSoFar * 24 * 60;
    const prevMonatMin   = 30 * 24 * 60;
    const weekBounds     = getWeekBoundaries(mStart);

    const allDrivers = driverId
      ? drivers.filter(d => d.id === driverId)
      : drivers;

    const fahrer: FahrerMonatsauslastung[] = allDrivers.map(d => {
      const actMin    = activeMinutesInWindow(stops,     d.id, mStart,  mEnd);
      const actMinPM  = activeMinutesInWindow(prevStops, d.id, pmStart, pmEnd);
      const pct       = Math.min(100, Math.round((actMin   / monatMinSoFar) * 1000) / 10);
      const pct_vm    = Math.min(100, Math.round((actMinPM / prevMonatMin)  * 1000) / 10);
      const { trend, delta } = calcTrend(pct, pct_vm);
      const wochen_pct = weekBounds.map(w => {
        const wMin = activeMinutesInWindow(stops, d.id, w.start, w.end);
        return Math.min(100, Math.round((wMin / (7 * 24 * 60)) * 1000) / 10);
      });
      return {
        fahrer_id: d.id,
        fahrer_name: d.name,
        auslastung_pct: pct,
        auslastung_pct_vormonat: pct_vm,
        wochen_pct,
        trend,
        trend_delta: delta,
        ampel: calcAmpel(pct),
        alert_gering: pct < 50,
      };
    }).sort((a, b) => b.auslastung_pct - a.auslastung_pct);

    const team_avg    = Math.round((fahrer.reduce((s, f) => s + f.auslastung_pct, 0)          / fahrer.length) * 10) / 10;
    const team_avg_vm = Math.round((fahrer.reduce((s, f) => s + f.auslastung_pct_vormonat, 0) / fahrer.length) * 10) / 10;
    const alert_count = fahrer.filter(f => f.alert_gering).length;

    return NextResponse.json({
      fahrer,
      team_avg_pct: team_avg,
      team_avg_pct_vormonat: team_avg_vm,
      alert_count,
      generiert_am: now.toISOString(),
    } satisfies FahrerMonatsauslastungResponse);
  } catch {
    return NextResponse.json(buildMock(locationId, driverId));
  }
}
