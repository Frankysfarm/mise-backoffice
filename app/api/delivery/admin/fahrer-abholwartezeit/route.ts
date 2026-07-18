/**
 * GET /api/delivery/admin/fahrer-abholwartezeit?location_id=<uuid>
 *
 * Phase 2264 — Fahrer-Abholwartezeit-API
 * Ø Wartezeit je Fahrer beim Restaurant heute (pickup_departed_at - pickup_arrived_at);
 * Trend vs. Vorwoche; Alert wenn Team-Ø >8 Min; Multi-Tenant; Supabase+Mock.
 *
 * Response: { location_id, fahrer: FahrerAbholwartezeit[], team_avg_min, alert_count, generiert_am }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type Ampel = 'gruen' | 'gelb' | 'rot';
export type Trend = 'steigend' | 'fallend' | 'stabil';

export interface FahrerAbholwartezeit {
  fahrer_id: string;
  fahrer_name: string;
  avg_min: number;
  touren_heute: number;
  touren_ueber8min: number;
  trend: Trend;
  trend_delta: number;
  ampel: Ampel;
  rang: number;
}

export interface FahrerAbholwartezeitAntwort {
  location_id: string;
  fahrer: FahrerAbholwartezeit[];
  team_avg_min: number;
  alert_count: number;
  generiert_am: string;
}

function ampelVon(min: number): Ampel {
  if (min <= 4) return 'gruen';
  if (min <= 8) return 'gelb';
  return 'rot';
}

function trendVon(heute: number, vorwoche: number): { trend: Trend; delta: number } {
  const delta = Math.round((heute - vorwoche) * 10) / 10;
  if (delta > 0.5) return { trend: 'steigend', delta };
  if (delta < -0.5) return { trend: 'fallend', delta };
  return { trend: 'stabil', delta };
}

const MOCK_FAHRER: Omit<FahrerAbholwartezeit, 'rang'>[] = [
  { fahrer_id: 'mock-f1', fahrer_name: 'Max Müller', avg_min: 2.8, touren_heute: 8, touren_ueber8min: 0, trend: 'stabil', trend_delta: 0.1, ampel: 'gruen' },
  { fahrer_id: 'mock-f2', fahrer_name: 'Sara Koch', avg_min: 5.4, touren_heute: 11, touren_ueber8min: 2, trend: 'steigend', trend_delta: 1.2, ampel: 'gelb' },
  { fahrer_id: 'mock-f3', fahrer_name: 'Tim Becker', avg_min: 10.7, touren_heute: 7, touren_ueber8min: 5, trend: 'steigend', trend_delta: 2.3, ampel: 'rot' },
  { fahrer_id: 'mock-f4', fahrer_name: 'Lisa Fuchs', avg_min: 3.1, touren_heute: 9, touren_ueber8min: 0, trend: 'fallend', trend_delta: -0.8, ampel: 'gruen' },
  { fahrer_id: 'mock-f5', fahrer_name: 'Jonas Weber', avg_min: 6.9, touren_heute: 10, touren_ueber8min: 3, trend: 'stabil', trend_delta: 0.2, ampel: 'gelb' },
];

function mockResponse(locationId: string): FahrerAbholwartezeitAntwort {
  const sorted = [...MOCK_FAHRER].sort((a, b) => b.avg_min - a.avg_min);
  const fahrer: FahrerAbholwartezeit[] = sorted.map((f, i) => ({ ...f, rang: i + 1 }));
  const team_avg_min = fahrer.length > 0
    ? Math.round((fahrer.reduce((s, f) => s + f.avg_min, 0) / fahrer.length) * 10) / 10
    : 0;
  const alert_count = fahrer.filter(f => f.ampel === 'rot').length;
  return { location_id: locationId, fahrer, team_avg_min, alert_count, generiert_am: new Date().toISOString() };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const locationId = req.nextUrl.searchParams.get('location_id') ?? '';

  try {
    const sb = await createClient();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();

    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);
    const lastWeekIso = lastWeek.toISOString();

    const { data: drivers } = await sb
      .from('employees')
      .select('id, vorname, nachname')
      .eq('location_id', locationId)
      .eq('kann_ausliefern', true)
      .eq('aktiv', true);

    if (!drivers || drivers.length === 0) {
      return NextResponse.json(mockResponse(locationId));
    }

    const { data: ordersToday } = await sb
      .from('orders')
      .select('driver_id, pickup_arrived_at, pickup_departed_at')
      .eq('location_id', locationId)
      .gte('created_at', todayIso)
      .not('pickup_arrived_at', 'is', null)
      .not('pickup_departed_at', 'is', null);

    if (!ordersToday || ordersToday.length === 0) {
      return NextResponse.json(mockResponse(locationId));
    }

    const { data: ordersVorwoche } = await sb
      .from('orders')
      .select('driver_id, pickup_arrived_at, pickup_departed_at')
      .eq('location_id', locationId)
      .gte('created_at', lastWeekIso)
      .lt('created_at', todayIso)
      .not('pickup_arrived_at', 'is', null)
      .not('pickup_departed_at', 'is', null);

    type OrderRow = { driver_id: string | null; pickup_arrived_at: string; pickup_departed_at: string };

    function buildWartezeitMap(rows: OrderRow[]): Map<string, { total: number; count: number; ueber8: number }> {
      const map = new Map<string, { total: number; count: number; ueber8: number }>();
      for (const o of rows) {
        if (!o.driver_id) continue;
        const arrived = new Date(o.pickup_arrived_at).getTime();
        const departed = new Date(o.pickup_departed_at).getTime();
        const min = Math.max(0, (departed - arrived) / 60000);
        const entry = map.get(o.driver_id) ?? { total: 0, count: 0, ueber8: 0 };
        entry.total += min;
        entry.count += 1;
        if (min > 8) entry.ueber8 += 1;
        map.set(o.driver_id, entry);
      }
      return map;
    }

    const todayMap = buildWartezeitMap(ordersToday as OrderRow[]);
    const vorwocheMap = buildWartezeitMap((ordersVorwoche ?? []) as OrderRow[]);

    const driverList: Omit<FahrerAbholwartezeit, 'rang'>[] = drivers
      .filter(d => todayMap.has(d.id))
      .map(d => {
        const t = todayMap.get(d.id)!;
        const v = vorwocheMap.get(d.id);
        const avgHeute = t.count > 0 ? Math.round((t.total / t.count) * 10) / 10 : 0;
        const avgVorwoche = v && v.count > 0 ? v.total / v.count : avgHeute;
        const { trend, delta } = trendVon(avgHeute, avgVorwoche);
        return {
          fahrer_id: d.id,
          fahrer_name: `${d.vorname} ${d.nachname[0]}.`,
          avg_min: avgHeute,
          touren_heute: t.count,
          touren_ueber8min: t.ueber8,
          trend,
          trend_delta: delta,
          ampel: ampelVon(avgHeute),
        };
      });

    if (driverList.length === 0) {
      return NextResponse.json(mockResponse(locationId));
    }

    const sorted = driverList.sort((a, b) => b.avg_min - a.avg_min);
    const fahrer: FahrerAbholwartezeit[] = sorted.map((f, i) => ({ ...f, rang: i + 1 }));
    const team_avg_min = fahrer.length > 0
      ? Math.round((fahrer.reduce((s, f) => s + f.avg_min, 0) / fahrer.length) * 10) / 10
      : 0;
    const alert_count = fahrer.filter(f => f.ampel === 'rot').length;

    return NextResponse.json({
      location_id: locationId,
      fahrer,
      team_avg_min,
      alert_count,
      generiert_am: new Date().toISOString(),
    } satisfies FahrerAbholwartezeitAntwort);
  } catch {
    return NextResponse.json(mockResponse(locationId));
  }
}
