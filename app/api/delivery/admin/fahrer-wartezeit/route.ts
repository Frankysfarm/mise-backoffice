/**
 * GET /api/delivery/admin/fahrer-wartezeit?location_id=<uuid>
 *
 * Phase 2321 — Fahrer-Wartezeit-API
 * Ø Wartezeit je Fahrer heute (Zeit von Ankunft am Restaurant bis Abholung);
 * Alert wenn Ø >10 Min; Trend vs. Vorwoche; Multi-Tenant; Supabase+Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALERT_WARTEZEIT_MIN = 10;

export type TrendWartezeit = 'steigend' | 'fallend' | 'stabil';
export type AmpelWartezeit = 'gruen' | 'gelb' | 'rot';

export interface FahrerWartezeitHeute {
  fahrer_id: string;
  fahrer_name: string;
  avg_wartezeit_min: number;
  touren_anzahl: number;
  max_wartezeit_min: number;
  avg_wartezeit_vorwoche: number | null;
  trend: TrendWartezeit;
  trend_delta: number;
  ampel: AmpelWartezeit;
  alert: boolean;
  rang: number;
}

export interface FahrerWartezeitAntwort {
  location_id: string;
  fahrer: FahrerWartezeitHeute[];
  team_avg_wartezeit_min: number;
  alert_count: number;
  generiert_am: string;
}

function ampelVon(min: number): AmpelWartezeit {
  if (min >= ALERT_WARTEZEIT_MIN) return 'rot';
  if (min >= 5) return 'gelb';
  return 'gruen';
}

function trendVon(heute: number, vorwoche: number | null): { trend: TrendWartezeit; delta: number } {
  if (vorwoche === null || vorwoche === 0) return { trend: 'stabil', delta: 0 };
  const delta = Math.round((heute - vorwoche) * 10) / 10;
  if (delta > 1) return { trend: 'steigend', delta };
  if (delta < -1) return { trend: 'fallend', delta };
  return { trend: 'stabil', delta };
}

const MOCK_FAHRER: Omit<FahrerWartezeitHeute, 'rang'>[] = [
  {
    fahrer_id: 'mock-f1',
    fahrer_name: 'Max Müller',
    avg_wartezeit_min: 4.2,
    touren_anzahl: 9,
    max_wartezeit_min: 7,
    avg_wartezeit_vorwoche: 5.1,
    trend: 'fallend',
    trend_delta: -0.9,
    ampel: 'gruen',
    alert: false,
  },
  {
    fahrer_id: 'mock-f2',
    fahrer_name: 'Sarah König',
    avg_wartezeit_min: 12.8,
    touren_anzahl: 14,
    max_wartezeit_min: 22,
    avg_wartezeit_vorwoche: 9.5,
    trend: 'steigend',
    trend_delta: 3.3,
    ampel: 'rot',
    alert: true,
  },
  {
    fahrer_id: 'mock-f3',
    fahrer_name: 'Lena Schneider',
    avg_wartezeit_min: 6.5,
    touren_anzahl: 7,
    max_wartezeit_min: 11,
    avg_wartezeit_vorwoche: 6.0,
    trend: 'stabil',
    trend_delta: 0.5,
    ampel: 'gelb',
    alert: false,
  },
  {
    fahrer_id: 'mock-f4',
    fahrer_name: 'Tom Becker',
    avg_wartezeit_min: 3.1,
    touren_anzahl: 3,
    max_wartezeit_min: 5,
    avg_wartezeit_vorwoche: 4.2,
    trend: 'fallend',
    trend_delta: -1.1,
    ampel: 'gruen',
    alert: false,
  },
  {
    fahrer_id: 'mock-f5',
    fahrer_name: 'Anna Braun',
    avg_wartezeit_min: 11.3,
    touren_anzahl: 11,
    max_wartezeit_min: 18,
    avg_wartezeit_vorwoche: 10.8,
    trend: 'steigend',
    trend_delta: 0.5,
    ampel: 'rot',
    alert: true,
  },
];

function buildMockResponse(location_id: string): FahrerWartezeitAntwort {
  const withRang = MOCK_FAHRER.map((f, i) => ({ ...f, rang: i + 1 }));
  const alertCount = withRang.filter((f) => f.alert).length;
  const teamAvg =
    withRang.length > 0
      ? Math.round((withRang.reduce((s, f) => s + f.avg_wartezeit_min, 0) / withRang.length) * 10) / 10
      : 0;
  return { location_id, fahrer: withRang, team_avg_wartezeit_min: teamAvg, alert_count: alertCount, generiert_am: new Date().toISOString() };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) {
    return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);
    const lastWeekStr = lastWeek.toISOString().slice(0, 10);

    const { data: tours, error } = await supabase
      .from('delivery_batches')
      .select('driver_id, driver_name, arrived_at, actual_pickup_at')
      .eq('location_id', locationId)
      .gte('created_at', todayStr)
      .lt('created_at', todayStr + 'T23:59:59')
      .not('arrived_at', 'is', null)
      .not('actual_pickup_at', 'is', null);

    if (error || !tours || tours.length === 0) {
      return NextResponse.json(buildMockResponse(locationId));
    }

    const byDriver = new Map<string, { name: string; wartezeiten: number[]; max: number }>();
    for (const t of tours) {
      if (!t.driver_id || !t.arrived_at || !t.actual_pickup_at) continue;
      const diffMin = (new Date(t.actual_pickup_at).getTime() - new Date(t.arrived_at).getTime()) / 60_000;
      if (diffMin < 0) continue;
      const entry = byDriver.get(t.driver_id) ?? { name: t.driver_name ?? t.driver_id, wartezeiten: [], max: 0 };
      entry.wartezeiten.push(diffMin);
      if (diffMin > entry.max) entry.max = diffMin;
      byDriver.set(t.driver_id, entry);
    }

    if (byDriver.size === 0) {
      return NextResponse.json(buildMockResponse(locationId));
    }

    const { data: toursVW } = await supabase
      .from('delivery_batches')
      .select('driver_id, arrived_at, actual_pickup_at')
      .eq('location_id', locationId)
      .gte('created_at', lastWeekStr)
      .lt('created_at', lastWeekStr + 'T23:59:59')
      .not('arrived_at', 'is', null)
      .not('actual_pickup_at', 'is', null);

    const vwByDriver = new Map<string, number[]>();
    for (const t of toursVW ?? []) {
      if (!t.driver_id || !t.arrived_at || !t.actual_pickup_at) continue;
      const diffMin = (new Date(t.actual_pickup_at).getTime() - new Date(t.arrived_at).getTime()) / 60_000;
      if (diffMin < 0) continue;
      const arr = vwByDriver.get(t.driver_id) ?? [];
      arr.push(diffMin);
      vwByDriver.set(t.driver_id, arr);
    }

    const fahrer: FahrerWartezeitHeute[] = [];
    let rank = 0;
    for (const [driver_id, entry] of byDriver.entries()) {
      rank++;
      const avg_wartezeit_min = Math.round((entry.wartezeiten.reduce((a, b) => a + b, 0) / entry.wartezeiten.length) * 10) / 10;
      const vwList = vwByDriver.get(driver_id);
      const avg_wartezeit_vorwoche = vwList && vwList.length > 0
        ? Math.round((vwList.reduce((a, b) => a + b, 0) / vwList.length) * 10) / 10
        : null;
      const { trend, delta } = trendVon(avg_wartezeit_min, avg_wartezeit_vorwoche);
      const ampel = ampelVon(avg_wartezeit_min);
      fahrer.push({
        fahrer_id: driver_id,
        fahrer_name: entry.name,
        avg_wartezeit_min,
        touren_anzahl: entry.wartezeiten.length,
        max_wartezeit_min: Math.round(entry.max * 10) / 10,
        avg_wartezeit_vorwoche,
        trend,
        trend_delta: delta,
        ampel,
        alert: ampel === 'rot',
        rang: rank,
      });
    }

    fahrer.sort((a, b) => b.avg_wartezeit_min - a.avg_wartezeit_min);
    fahrer.forEach((f, i) => (f.rang = i + 1));

    const alertCount = fahrer.filter((f) => f.alert).length;
    const teamAvg = fahrer.length > 0
      ? Math.round((fahrer.reduce((s, f) => s + f.avg_wartezeit_min, 0) / fahrer.length) * 10) / 10
      : 0;

    return NextResponse.json({
      location_id: locationId,
      fahrer,
      team_avg_wartezeit_min: teamAvg,
      alert_count: alertCount,
      generiert_am: new Date().toISOString(),
    } satisfies FahrerWartezeitAntwort);
  } catch {
    return NextResponse.json(buildMockResponse(locationId));
  }
}
