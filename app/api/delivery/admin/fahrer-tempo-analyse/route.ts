/**
 * GET /api/delivery/admin/fahrer-tempo-analyse?location_id=<uuid>
 *
 * Phase 2316 — Fahrer-Tempo-Analyse-API
 * Ø km/h je Fahrer heute; Alert wenn Ø >60 km/h (Tempoverdacht) oder <5 km/h (Stau-Indikator);
 * Trend vs. gleicher Wochentag letzte Woche; Multi-Tenant; Supabase+Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALERT_TEMPO_HOCH = 60;
const ALERT_TEMPO_NIEDRIG = 5;

export type TrendTempo = 'steigend' | 'fallend' | 'stabil';
export type AmpelTempo = 'gruen' | 'gelb' | 'rot';
export type AlertTyp = 'tempoverdacht' | 'stau' | null;

export interface FahrerTempoHeute {
  fahrer_id: string;
  fahrer_name: string;
  avg_kmh: number;
  touren_anzahl: number;
  fahrzeit_min: number;
  km_gesamt: number;
  avg_kmh_vorwoche: number | null;
  trend: TrendTempo;
  trend_delta: number;
  ampel: AmpelTempo;
  alert_typ: AlertTyp;
  alert: boolean;
  rang: number;
}

export interface FahrerTempoAntwort {
  location_id: string;
  fahrer: FahrerTempoHeute[];
  team_avg_kmh: number;
  alert_count: number;
  generiert_am: string;
}

function ampelVon(kmh: number): AmpelTempo {
  if (kmh > ALERT_TEMPO_HOCH || (kmh < ALERT_TEMPO_NIEDRIG && kmh > 0)) return 'rot';
  if (kmh >= 50) return 'gelb';
  return 'gruen';
}

function alertTypVon(kmh: number): AlertTyp {
  if (kmh > ALERT_TEMPO_HOCH) return 'tempoverdacht';
  if (kmh < ALERT_TEMPO_NIEDRIG && kmh > 0) return 'stau';
  return null;
}

function trendVon(heute: number, vorwoche: number | null): { trend: TrendTempo; delta: number } {
  if (vorwoche === null || vorwoche === 0) return { trend: 'stabil', delta: 0 };
  const delta = Math.round((heute - vorwoche) * 10) / 10;
  if (delta > 2) return { trend: 'steigend', delta };
  if (delta < -2) return { trend: 'fallend', delta };
  return { trend: 'stabil', delta };
}

const MOCK_FAHRER: Omit<FahrerTempoHeute, 'rang'>[] = [
  {
    fahrer_id: 'mock-f1',
    fahrer_name: 'Max Müller',
    avg_kmh: 32,
    touren_anzahl: 9,
    fahrzeit_min: 163,
    km_gesamt: 87,
    avg_kmh_vorwoche: 30,
    trend: 'steigend',
    trend_delta: 2,
    ampel: 'gruen',
    alert_typ: null,
    alert: false,
  },
  {
    fahrer_id: 'mock-f2',
    fahrer_name: 'Sarah König',
    avg_kmh: 63,
    touren_anzahl: 14,
    fahrzeit_min: 150,
    km_gesamt: 158,
    avg_kmh_vorwoche: 55,
    trend: 'steigend',
    trend_delta: 8,
    ampel: 'rot',
    alert_typ: 'tempoverdacht',
    alert: true,
  },
  {
    fahrer_id: 'mock-f3',
    fahrer_name: 'Lena Schneider',
    avg_kmh: 28,
    touren_anzahl: 7,
    fahrzeit_min: 120,
    km_gesamt: 56,
    avg_kmh_vorwoche: 31,
    trend: 'fallend',
    trend_delta: -3,
    ampel: 'gruen',
    alert_typ: null,
    alert: false,
  },
  {
    fahrer_id: 'mock-f4',
    fahrer_name: 'Tom Becker',
    avg_kmh: 3,
    touren_anzahl: 3,
    fahrzeit_min: 240,
    km_gesamt: 12,
    avg_kmh_vorwoche: 25,
    trend: 'fallend',
    trend_delta: -22,
    ampel: 'rot',
    alert_typ: 'stau',
    alert: true,
  },
  {
    fahrer_id: 'mock-f5',
    fahrer_name: 'Anna Braun',
    avg_kmh: 52,
    touren_anzahl: 11,
    fahrzeit_min: 95,
    km_gesamt: 82,
    avg_kmh_vorwoche: 48,
    trend: 'steigend',
    trend_delta: 4,
    ampel: 'gelb',
    alert_typ: null,
    alert: false,
  },
];

function buildMockResponse(location_id: string): FahrerTempoAntwort {
  const withRang = MOCK_FAHRER.map((f, i) => ({ ...f, rang: i + 1 }));
  const alertCount = withRang.filter((f) => f.alert).length;
  const teamAvg =
    withRang.length > 0
      ? Math.round((withRang.reduce((s, f) => s + f.avg_kmh, 0) / withRang.length) * 10) / 10
      : 0;
  return { location_id, fahrer: withRang, team_avg_kmh: teamAvg, alert_count: alertCount, generiert_am: new Date().toISOString() };
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
      .select('driver_id, driver_name, distance_km, actual_departure_at, completed_at')
      .eq('location_id', locationId)
      .gte('created_at', todayStr)
      .lt('created_at', todayStr + 'T23:59:59')
      .eq('status', 'completed')
      .not('distance_km', 'is', null)
      .not('actual_departure_at', 'is', null)
      .not('completed_at', 'is', null);

    if (error || !tours || tours.length === 0) {
      return NextResponse.json(buildMockResponse(locationId));
    }

    // Group by driver
    const byDriver = new Map<string, { name: string; kmh_list: number[]; km_total: number; fahrzeit_min: number; touren: number }>();
    for (const t of tours) {
      if (!t.driver_id || !t.distance_km) continue;
      const fahrzeitMs = new Date(t.completed_at).getTime() - new Date(t.actual_departure_at).getTime();
      const fahrzeitH = fahrzeitMs / 3_600_000;
      if (fahrzeitH <= 0) continue;
      const kmh = Math.round((t.distance_km / fahrzeitH) * 10) / 10;
      const entry = byDriver.get(t.driver_id) ?? { name: t.driver_name ?? t.driver_id, kmh_list: [] as number[], km_total: 0, fahrzeit_min: 0, touren: 0 };
      entry.kmh_list.push(kmh);
      entry.km_total += t.distance_km;
      entry.fahrzeit_min += fahrzeitMs / 60_000;
      entry.touren += 1;
      byDriver.set(t.driver_id, entry);
    }

    if (byDriver.size === 0) {
      return NextResponse.json(buildMockResponse(locationId));
    }

    // Vorwoche
    const { data: toursVW } = await supabase
      .from('delivery_batches')
      .select('driver_id, distance_km, actual_departure_at, completed_at')
      .eq('location_id', locationId)
      .gte('created_at', lastWeekStr)
      .lt('created_at', lastWeekStr + 'T23:59:59')
      .eq('status', 'completed')
      .not('distance_km', 'is', null);

    const vwByDriver = new Map<string, number[]>();
    for (const t of toursVW ?? []) {
      if (!t.driver_id || !t.distance_km || !t.actual_departure_at || !t.completed_at) continue;
      const fahrzeitH = (new Date(t.completed_at).getTime() - new Date(t.actual_departure_at).getTime()) / 3_600_000;
      if (fahrzeitH <= 0) continue;
      const kmh = t.distance_km / fahrzeitH;
      const arr = vwByDriver.get(t.driver_id) ?? [];
      arr.push(kmh);
      vwByDriver.set(t.driver_id, arr);
    }

    const fahrer: FahrerTempoHeute[] = [];
    let rank = 0;
    for (const [driver_id, entry] of byDriver.entries()) {
      rank++;
      const avg_kmh = Math.round((entry.kmh_list.reduce((a, b) => a + b, 0) / entry.kmh_list.length) * 10) / 10;
      const vwList = vwByDriver.get(driver_id);
      const avg_kmh_vorwoche = vwList && vwList.length > 0
        ? Math.round((vwList.reduce((a, b) => a + b, 0) / vwList.length) * 10) / 10
        : null;
      const { trend, delta } = trendVon(avg_kmh, avg_kmh_vorwoche);
      const ampel = ampelVon(avg_kmh);
      const alert_typ = alertTypVon(avg_kmh);
      fahrer.push({
        fahrer_id: driver_id,
        fahrer_name: entry.name,
        avg_kmh,
        touren_anzahl: entry.touren,
        fahrzeit_min: Math.round(entry.fahrzeit_min),
        km_gesamt: Math.round(entry.km_total * 10) / 10,
        avg_kmh_vorwoche,
        trend,
        trend_delta: delta,
        ampel,
        alert_typ,
        alert: alert_typ !== null,
        rang: rank,
      });
    }

    fahrer.sort((a, b) => b.avg_kmh - a.avg_kmh);
    fahrer.forEach((f, i) => (f.rang = i + 1));

    const alertCount = fahrer.filter((f) => f.alert).length;
    const teamAvg = fahrer.length > 0
      ? Math.round((fahrer.reduce((s, f) => s + f.avg_kmh, 0) / fahrer.length) * 10) / 10
      : 0;

    return NextResponse.json({
      location_id: locationId,
      fahrer,
      team_avg_kmh: teamAvg,
      alert_count: alertCount,
      generiert_am: new Date().toISOString(),
    } satisfies FahrerTempoAntwort);
  } catch {
    return NextResponse.json(buildMockResponse(locationId));
  }
}
