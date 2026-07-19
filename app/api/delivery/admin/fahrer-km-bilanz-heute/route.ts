/**
 * GET /api/delivery/admin/fahrer-km-bilanz-heute?location_id=<uuid>[&driver_id=<uuid>]
 *
 * Phase 2599 — Fahrer-km-Bilanz
 * Gefahrene km je Fahrer heute; Ampel grün(≥80 km)/gelb(50–79 km)/rot(<50 km);
 * Alert <50 km; Trend vs. gestern; driver_id-Modus; Multi-Tenant;
 * Supabase(delivery_tours.distance_km)+Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ZIEL_KM   = 80;
const ALERT_KM  = 50;
const GRUEN_KM  = 80;
const GELB_KM   = 50;

export type AmpelKm = 'gruen' | 'gelb' | 'rot';
export type TrendKm = 'besser' | 'schlechter' | 'stabil';

export interface FahrerKmBilanzEntry {
  fahrer_id: string;
  fahrer_name: string;
  km_heute: number;
  km_gestern: number | null;
  trend: TrendKm;
  trend_delta: number;
  ampel: AmpelKm;
  alert: boolean;
}

export interface FahrerKmBilanzAntwort {
  location_id: string;
  fahrer: FahrerKmBilanzEntry[];
  fahrer_single?: FahrerKmBilanzEntry;
  team_avg_heute: number;
  team_avg_gestern: number | null;
  ziel: number;
  alert_count: number;
  generiert_am: string;
}

function ampelVon(km: number): AmpelKm {
  if (km >= GRUEN_KM) return 'gruen';
  if (km >= GELB_KM)  return 'gelb';
  return 'rot';
}

function trendVon(heute: number, gestern: number | null): { trend: TrendKm; delta: number } {
  if (gestern === null) return { trend: 'stabil', delta: 0 };
  const delta = Math.round((heute - gestern) * 10) / 10;
  if (delta >= 5)  return { trend: 'besser',     delta };
  if (delta <= -5) return { trend: 'schlechter', delta };
  return { trend: 'stabil', delta };
}

const MOCK_FAHRER: FahrerKmBilanzEntry[] = [
  { fahrer_id: 'mock-f1', fahrer_name: 'Max Müller',     km_heute: 94, km_gestern: 81, trend: 'besser',     trend_delta: 13,  ampel: 'gruen', alert: false },
  { fahrer_id: 'mock-f2', fahrer_name: 'Sarah König',    km_heute: 38, km_gestern: 62, trend: 'schlechter', trend_delta: -24, ampel: 'rot',   alert: true  },
  { fahrer_id: 'mock-f3', fahrer_name: 'Lena Schneider', km_heute: 67, km_gestern: 70, trend: 'stabil',     trend_delta: -3,  ampel: 'gelb',  alert: false },
  { fahrer_id: 'mock-f4', fahrer_name: 'Tom Becker',     km_heute: 85, km_gestern: 88, trend: 'stabil',     trend_delta: -3,  ampel: 'gruen', alert: false },
  { fahrer_id: 'mock-f5', fahrer_name: 'Jana Fischer',   km_heute: 42, km_gestern: 75, trend: 'schlechter', trend_delta: -33, ampel: 'rot',   alert: true  },
];

function mockAntwort(locationId: string, driverId?: string | null): FahrerKmBilanzAntwort {
  const alertCount  = MOCK_FAHRER.filter(f => f.alert).length;
  const teamAvg     = Math.round(MOCK_FAHRER.reduce((s, f) => s + f.km_heute,          0) / MOCK_FAHRER.length * 10) / 10;
  const teamGestern = Math.round(MOCK_FAHRER.reduce((s, f) => s + (f.km_gestern ?? 0), 0) / MOCK_FAHRER.length * 10) / 10;
  const base: FahrerKmBilanzAntwort = {
    location_id:      locationId,
    fahrer:           MOCK_FAHRER,
    team_avg_heute:   teamAvg,
    team_avg_gestern: teamGestern,
    ziel:             ZIEL_KM,
    alert_count:      alertCount,
    generiert_am:     new Date().toISOString(),
  };
  if (driverId) {
    const me = MOCK_FAHRER.find(f => f.fahrer_id === driverId) ?? MOCK_FAHRER[0];
    return { ...base, fahrer_single: me };
  }
  return base;
}

export async function GET(req: NextRequest) {
  const url        = new URL(req.url);
  const locationId = url.searchParams.get('location_id');
  const driverId   = url.searchParams.get('driver_id');

  if (!locationId) return NextResponse.json(mockAntwort('demo', driverId));

  try {
    const sb = await createClient();
    const now = new Date();

    const todayStart = new Date(now);
    todayStart.setUTCHours(4, 0, 0, 0);
    if (now.getUTCHours() < 4) todayStart.setUTCDate(todayStart.getUTCDate() - 1);
    const todayEnd = new Date(todayStart);
    todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);

    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setUTCDate(yesterdayStart.getUTCDate() - 1);
    const yesterdayEnd = new Date(todayStart);

    const [{ data: todayData }, { data: yesterdayData }, { data: employeesData }] = await Promise.all([
      sb.from('delivery_tours')
        .select('driver_id, distance_km')
        .eq('location_id', locationId)
        .gte('started_at', todayStart.toISOString())
        .lt('started_at', todayEnd.toISOString()),
      sb.from('delivery_tours')
        .select('driver_id, distance_km')
        .eq('location_id', locationId)
        .gte('started_at', yesterdayStart.toISOString())
        .lt('started_at', yesterdayEnd.toISOString()),
      sb.from('employees')
        .select('id, vorname, nachname')
        .eq('location_id', locationId),
    ]);

    if (!todayData || todayData.length === 0) {
      return NextResponse.json(mockAntwort(locationId, driverId));
    }

    const nameMap = new Map<string, string>();
    for (const e of employeesData ?? []) {
      nameMap.set(e.id, `${e.vorname} ${e.nachname}`);
    }

    const todayMap = new Map<string, number>();
    for (const t of todayData) {
      todayMap.set(t.driver_id, (todayMap.get(t.driver_id) ?? 0) + (t.distance_km ?? 0));
    }

    const yesterdayMap = new Map<string, number>();
    for (const t of yesterdayData ?? []) {
      yesterdayMap.set(t.driver_id, (yesterdayMap.get(t.driver_id) ?? 0) + (t.distance_km ?? 0));
    }

    const fahrer: FahrerKmBilanzEntry[] = Array.from(todayMap.entries()).map(([id, kmHeute]) => {
      const kmGestern = yesterdayMap.has(id) ? yesterdayMap.get(id)! : null;
      const { trend, delta } = trendVon(kmHeute, kmGestern);
      return {
        fahrer_id:   id,
        fahrer_name: nameMap.get(id) ?? 'Fahrer',
        km_heute:    Math.round(kmHeute  * 10) / 10,
        km_gestern:  kmGestern !== null ? Math.round(kmGestern * 10) / 10 : null,
        trend,
        trend_delta: delta,
        ampel:       ampelVon(kmHeute),
        alert:       kmHeute < ALERT_KM,
      };
    });

    const teamAvg     = fahrer.length ? Math.round(fahrer.reduce((s, f) => s + f.km_heute,            0) / fahrer.length * 10) / 10 : 0;
    const gFahrer     = fahrer.filter(f => f.km_gestern !== null);
    const teamGestern = gFahrer.length ? Math.round(gFahrer.reduce((s, f) => s + (f.km_gestern ?? 0), 0) / gFahrer.length * 10) / 10 : null;

    const antwort: FahrerKmBilanzAntwort = {
      location_id:      locationId,
      fahrer,
      team_avg_heute:   teamAvg,
      team_avg_gestern: teamGestern,
      ziel:             ZIEL_KM,
      alert_count:      fahrer.filter(f => f.alert).length,
      generiert_am:     new Date().toISOString(),
    };

    if (driverId) {
      const me = fahrer.find(f => f.fahrer_id === driverId);
      if (me) antwort.fahrer_single = me;
    }

    return NextResponse.json(antwort);
  } catch {
    return NextResponse.json(mockAntwort(locationId, driverId));
  }
}
