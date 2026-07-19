/**
 * GET /api/delivery/admin/fahrer-wartezeit-depot?location_id=<uuid>[&driver_id=<uuid>]
 *
 * Phase 2529 — Fahrer-Wartezeit-Depot
 * Ø Wartezeit am Depot je Fahrer heute (Zeit zwischen Tour-Ende und nächstem Tour-Start);
 * Ampel grün(≤10min)/gelb(10–20min)/rot(>20min); Alert >20min; Trend vs. Vorwoche;
 * driver_id-Modus; Multi-Tenant; Supabase+Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALERT_MIN = 20;
const GELB_MIN = 10;

export type TrendDepot = 'steigend' | 'fallend' | 'stabil';
export type AmpelDepot = 'gruen' | 'gelb' | 'rot';

export interface FahrerWartezeitDepotEntry {
  fahrer_id: string;
  fahrer_name: string;
  avg_wartezeit_depot_min: number;
  avg_wartezeit_depot_vw: number | null;
  intervalle_anzahl: number;
  trend: TrendDepot;
  trend_delta: number;
  ampel: AmpelDepot;
  alert: boolean;
}

export interface FahrerWartezeitDepotAntwort {
  location_id: string;
  fahrer: FahrerWartezeitDepotEntry[];
  fahrer_single?: FahrerWartezeitDepotEntry;
  team_avg_wartezeit_depot_min: number;
  alert_count: number;
  generiert_am: string;
}

function ampelVon(min: number): AmpelDepot {
  if (min > ALERT_MIN) return 'rot';
  if (min > GELB_MIN) return 'gelb';
  return 'gruen';
}

function trendVon(heute: number, vw: number | null): { trend: TrendDepot; delta: number } {
  if (vw === null || vw === 0) return { trend: 'stabil', delta: 0 };
  const delta = Math.round((heute - vw) * 10) / 10;
  if (delta > 1) return { trend: 'steigend', delta };
  if (delta < -1) return { trend: 'fallend', delta };
  return { trend: 'stabil', delta };
}

const MOCK_FAHRER: FahrerWartezeitDepotEntry[] = [
  { fahrer_id: 'mock-f1', fahrer_name: 'Max Müller',     avg_wartezeit_depot_min: 8.2,  avg_wartezeit_depot_vw: 9.5,  intervalle_anzahl: 8,  trend: 'fallend',  trend_delta: -1.3, ampel: 'gruen', alert: false },
  { fahrer_id: 'mock-f2', fahrer_name: 'Sarah König',    avg_wartezeit_depot_min: 25.4, avg_wartezeit_depot_vw: 18.1, intervalle_anzahl: 13, trend: 'steigend', trend_delta:  7.3, ampel: 'rot',   alert: true  },
  { fahrer_id: 'mock-f3', fahrer_name: 'Lena Schneider', avg_wartezeit_depot_min: 14.7, avg_wartezeit_depot_vw: 14.2, intervalle_anzahl: 6,  trend: 'stabil',   trend_delta:  0.5, ampel: 'gelb',  alert: false },
  { fahrer_id: 'mock-f4', fahrer_name: 'Tom Becker',     avg_wartezeit_depot_min: 6.1,  avg_wartezeit_depot_vw: 7.8,  intervalle_anzahl: 4,  trend: 'fallend',  trend_delta: -1.7, ampel: 'gruen', alert: false },
  { fahrer_id: 'mock-f5', fahrer_name: 'Anna Braun',     avg_wartezeit_depot_min: 22.9, avg_wartezeit_depot_vw: 20.0, intervalle_anzahl: 10, trend: 'steigend', trend_delta:  2.9, ampel: 'rot',   alert: true  },
];

function buildMockResponse(location_id: string, driver_id?: string | null): FahrerWartezeitDepotAntwort {
  const fahrer = [...MOCK_FAHRER].sort((a, b) => b.avg_wartezeit_depot_min - a.avg_wartezeit_depot_min);
  const alertCount = fahrer.filter((f) => f.alert).length;
  const teamAvg = Math.round((fahrer.reduce((s, f) => s + f.avg_wartezeit_depot_min, 0) / fahrer.length) * 10) / 10;
  const single = driver_id ? fahrer.find((f) => f.fahrer_id === driver_id) ?? fahrer[0] : undefined;
  return { location_id, fahrer, fahrer_single: single, team_avg_wartezeit_depot_min: teamAvg, alert_count: alertCount, generiert_am: new Date().toISOString() };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });
  const driverId = req.nextUrl.searchParams.get('driver_id');

  try {
    const supabase = await createClient();

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);
    const lastWeekStr = lastWeek.toISOString().slice(0, 10);

    // Alle heutigen abgeschlossenen Touren mit Ende-Zeit (completed_at) und Fahrer
    const { data: tours, error } = await supabase
      .from('delivery_batches')
      .select('driver_id, driver_name, started_at, completed_at')
      .eq('location_id', locationId)
      .eq('status', 'completed')
      .gte('created_at', todayStr)
      .lt('created_at', todayStr + 'T23:59:59')
      .not('started_at', 'is', null)
      .not('completed_at', 'is', null)
      .order('driver_id')
      .order('started_at');

    if (error || !tours || tours.length === 0) {
      return NextResponse.json(buildMockResponse(locationId, driverId));
    }

    // Berechne Wartezeiten zwischen Tour-Ende und nächstem Tour-Start je Fahrer
    const byDriver = new Map<string, { name: string; intervals: number[] }>();
    const byDriverOrdered = new Map<string, { end: number; name: string }[]>();

    for (const t of tours) {
      if (!t.driver_id || !t.started_at || !t.completed_at) continue;
      const entry = byDriverOrdered.get(t.driver_id) ?? [];
      entry.push({ end: new Date(t.completed_at).getTime(), name: t.driver_name ?? t.driver_id });
      byDriverOrdered.set(t.driver_id, entry);
    }

    // started_at je Fahrer auch sammeln für Gap-Berechnung
    const startsByDriver = new Map<string, number[]>();
    for (const t of tours) {
      if (!t.driver_id || !t.started_at) continue;
      const arr = startsByDriver.get(t.driver_id) ?? [];
      arr.push(new Date(t.started_at).getTime());
      startsByDriver.set(t.driver_id, arr);
    }

    for (const [dId, ends] of byDriverOrdered.entries()) {
      const starts = (startsByDriver.get(dId) ?? []).sort((a, b) => a - b);
      const sortedEnds = ends.sort((a, b) => a.end - b.end);
      const intervals: number[] = [];
      for (let i = 0; i < sortedEnds.length; i++) {
        const endTime = sortedEnds[i].end;
        const nextStart = starts.find((s) => s > endTime);
        if (nextStart !== undefined) {
          const gapMin = (nextStart - endTime) / 60_000;
          if (gapMin >= 0 && gapMin < 120) intervals.push(gapMin);
        }
      }
      if (intervals.length > 0) {
        byDriver.set(dId, { name: sortedEnds[0].name, intervals });
      }
    }

    if (byDriver.size === 0) {
      return NextResponse.json(buildMockResponse(locationId, driverId));
    }

    // Vorwoche
    const { data: toursVW } = await supabase
      .from('delivery_batches')
      .select('driver_id, started_at, completed_at')
      .eq('location_id', locationId)
      .eq('status', 'completed')
      .gte('created_at', lastWeekStr)
      .lt('created_at', lastWeekStr + 'T23:59:59')
      .not('started_at', 'is', null)
      .not('completed_at', 'is', null)
      .order('driver_id')
      .order('started_at');

    const vwByDriver = new Map<string, number[]>();
    const vwEndsByDriver = new Map<string, number[]>();
    const vwStartsByDriver = new Map<string, number[]>();
    for (const t of toursVW ?? []) {
      if (!t.driver_id || !t.started_at || !t.completed_at) continue;
      const ends = vwEndsByDriver.get(t.driver_id) ?? [];
      ends.push(new Date(t.completed_at).getTime());
      vwEndsByDriver.set(t.driver_id, ends);
      const sts = vwStartsByDriver.get(t.driver_id) ?? [];
      sts.push(new Date(t.started_at).getTime());
      vwStartsByDriver.set(t.driver_id, sts);
    }
    for (const [dId, ends] of vwEndsByDriver.entries()) {
      const starts = (vwStartsByDriver.get(dId) ?? []).sort((a, b) => a - b);
      const sortedEnds = ends.sort((a, b) => a - b);
      const intervals: number[] = [];
      for (const endTime of sortedEnds) {
        const nextStart = starts.find((s) => s > endTime);
        if (nextStart !== undefined) {
          const gapMin = (nextStart - endTime) / 60_000;
          if (gapMin >= 0 && gapMin < 120) intervals.push(gapMin);
        }
      }
      if (intervals.length > 0) {
        vwByDriver.set(dId, intervals);
      }
    }

    const fahrer: FahrerWartezeitDepotEntry[] = [];
    for (const [dId, entry] of byDriver.entries()) {
      const avg = Math.round((entry.intervals.reduce((a, b) => a + b, 0) / entry.intervals.length) * 10) / 10;
      const vwList = vwByDriver.get(dId);
      const avgVW = vwList && vwList.length > 0
        ? Math.round((vwList.reduce((a, b) => a + b, 0) / vwList.length) * 10) / 10
        : null;
      const { trend, delta } = trendVon(avg, avgVW);
      const ampel = ampelVon(avg);
      fahrer.push({
        fahrer_id: dId,
        fahrer_name: entry.name,
        avg_wartezeit_depot_min: avg,
        avg_wartezeit_depot_vw: avgVW,
        intervalle_anzahl: entry.intervals.length,
        trend,
        trend_delta: delta,
        ampel,
        alert: ampel === 'rot',
      });
    }

    fahrer.sort((a, b) => b.avg_wartezeit_depot_min - a.avg_wartezeit_depot_min);

    const alertCount = fahrer.filter((f) => f.alert).length;
    const teamAvg = fahrer.length > 0
      ? Math.round((fahrer.reduce((s, f) => s + f.avg_wartezeit_depot_min, 0) / fahrer.length) * 10) / 10
      : 0;
    const single = driverId ? fahrer.find((f) => f.fahrer_id === driverId) : undefined;

    return NextResponse.json({
      location_id: locationId,
      fahrer,
      fahrer_single: single,
      team_avg_wartezeit_depot_min: teamAvg,
      alert_count: alertCount,
      generiert_am: new Date().toISOString(),
    } satisfies FahrerWartezeitDepotAntwort);
  } catch {
    return NextResponse.json(buildMockResponse(locationId, driverId));
  }
}
