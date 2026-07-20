/**
 * GET /api/delivery/admin/fahrer-ueberstunden-v2?location_id=<uuid>[&driver_id=<uuid>]
 *
 * Phase 2666 — Fahrer-Überstunden-API (v2)
 * Überstunden je Fahrer heute in Min (tatsächliche Schichtlänge minus geplante);
 * Ampel grün(≤15 Min)/gelb(16–45 Min)/rot(>45 Min); Alert >45 Min; Trend vs. gestern; Multi-Tenant; Supabase+Mock.
 *
 * Response: { location_id, fahrer: FahrerUeberstunden2666[], team_avg_ueberstunden, alert_count, generiert_am }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type Ampel = 'gruen' | 'gelb' | 'rot';
export type Trend = 'steigend' | 'fallend' | 'stabil';

export interface FahrerUeberstunden2666 {
  fahrer_id: string;
  fahrer_name: string;
  ueberstunden_min: number;
  schicht_geplant_min: number;
  trend: Trend;
  trend_delta: number;
  ampel: Ampel;
  rang: number;
}

export interface FahrerUeberstunden2666Antwort {
  location_id: string;
  fahrer: FahrerUeberstunden2666[];
  team_avg_ueberstunden: number;
  alert_count: number;
  generiert_am: string;
}

function ampelVon(min: number): Ampel {
  if (min <= 15) return 'gruen';
  if (min <= 45) return 'gelb';
  return 'rot';
}

function trendVon(heute: number, gestern: number): { trend: Trend; delta: number } {
  const delta = Math.round(heute - gestern);
  if (delta > 5)  return { trend: 'steigend', delta };
  if (delta < -5) return { trend: 'fallend',  delta };
  return { trend: 'stabil', delta };
}

const MOCK_FAHRER: Omit<FahrerUeberstunden2666, 'rang'>[] = [
  { fahrer_id: 'mock-f1', fahrer_name: 'Max Müller',  ueberstunden_min: 12, schicht_geplant_min: 480, trend: 'stabil',   trend_delta:  3, ampel: 'gruen' },
  { fahrer_id: 'mock-f2', fahrer_name: 'Sara Koch',   ueberstunden_min: 32, schicht_geplant_min: 480, trend: 'steigend', trend_delta: 12, ampel: 'gelb'  },
  { fahrer_id: 'mock-f3', fahrer_name: 'Tim Becker',  ueberstunden_min: 67, schicht_geplant_min: 480, trend: 'steigend', trend_delta: 22, ampel: 'rot'   },
  { fahrer_id: 'mock-f4', fahrer_name: 'Lisa Fuchs',  ueberstunden_min:  8, schicht_geplant_min: 480, trend: 'fallend',  trend_delta: -7, ampel: 'gruen' },
  { fahrer_id: 'mock-f5', fahrer_name: 'Jonas Weber', ueberstunden_min: 51, schicht_geplant_min: 480, trend: 'steigend', trend_delta: 15, ampel: 'rot'   },
];

function mockResponse(locationId: string): FahrerUeberstunden2666Antwort {
  const sorted = [...MOCK_FAHRER].sort((a, b) => b.ueberstunden_min - a.ueberstunden_min);
  const fahrer = sorted.map((f, i) => ({ ...f, rang: i + 1 }));
  const team_avg_ueberstunden = fahrer.length > 0
    ? Math.round(fahrer.reduce((s, f) => s + f.ueberstunden_min, 0) / fahrer.length)
    : 0;
  const alert_count = fahrer.filter(f => f.ueberstunden_min > 45).length;
  return { location_id: locationId, fahrer, team_avg_ueberstunden, alert_count, generiert_am: new Date().toISOString() };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const locationId = req.nextUrl.searchParams.get('location_id') ?? '';
  const driverId   = req.nextUrl.searchParams.get('driver_id');

  try {
    const sb    = await createClient();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayIso = yesterday.toISOString();

    const now = new Date();

    let shiftsQuery = sb
      .from('driver_shifts')
      .select('driver_id, planned_start, planned_end, actual_start, actual_end')
      .eq('location_id', locationId)
      .gte('planned_start', todayIso);
    if (driverId) shiftsQuery = shiftsQuery.eq('driver_id', driverId);

    const { data: shifts } = await shiftsQuery;
    if (!shifts || shifts.length === 0) return NextResponse.json(mockResponse(locationId));

    let shiftsGesternQuery = sb
      .from('driver_shifts')
      .select('driver_id, planned_start, planned_end, actual_start, actual_end')
      .eq('location_id', locationId)
      .gte('planned_start', yesterdayIso)
      .lt('planned_start', todayIso);
    if (driverId) shiftsGesternQuery = shiftsGesternQuery.eq('driver_id', driverId);

    const { data: shiftsGestern } = await shiftsGesternQuery;

    let driversQuery = sb
      .from('employees')
      .select('id, vorname, nachname')
      .eq('location_id', locationId)
      .eq('kann_ausliefern', true)
      .eq('aktiv', true);
    if (driverId) driversQuery = driversQuery.eq('id', driverId);

    const { data: drivers } = await driversQuery;
    if (!drivers || drivers.length === 0) return NextResponse.json(mockResponse(locationId));

    type ShiftRow = { driver_id: string | null; planned_start: string | null; planned_end: string | null; actual_start: string | null; actual_end: string | null };

    function calcUeberstundenMin(shift: ShiftRow): number {
      if (!shift.planned_end) return 0;
      const plannedEnd = new Date(shift.planned_end);
      const actualEnd  = shift.actual_end ? new Date(shift.actual_end) : now;
      const diff = (actualEnd.getTime() - plannedEnd.getTime()) / 60000;
      return Math.max(0, Math.round(diff));
    }

    function calcGeplantMin(shift: ShiftRow): number {
      if (!shift.planned_start || !shift.planned_end) return 480;
      return Math.round((new Date(shift.planned_end).getTime() - new Date(shift.planned_start).getTime()) / 60000);
    }

    const heuteMap = new Map<string, { min: number; geplant: number }>();
    for (const s of (shifts as ShiftRow[])) {
      if (!s.driver_id) continue;
      const prev = heuteMap.get(s.driver_id) ?? { min: 0, geplant: 0 };
      heuteMap.set(s.driver_id, {
        min:     prev.min     + calcUeberstundenMin(s),
        geplant: prev.geplant + calcGeplantMin(s),
      });
    }

    const gesternMap = new Map<string, number>();
    for (const s of ((shiftsGestern ?? []) as ShiftRow[])) {
      if (!s.driver_id) continue;
      gesternMap.set(s.driver_id, (gesternMap.get(s.driver_id) ?? 0) + calcUeberstundenMin(s));
    }

    const driverList: Omit<FahrerUeberstunden2666, 'rang'>[] = drivers
      .filter(d => heuteMap.has(d.id))
      .map(d => {
        const { min, geplant } = heuteMap.get(d.id)!;
        const gestern          = gesternMap.get(d.id) ?? 0;
        const { trend, delta } = trendVon(min, gestern);
        return {
          fahrer_id:           d.id,
          fahrer_name:         `${d.vorname} ${d.nachname[0]}.`,
          ueberstunden_min:    min,
          schicht_geplant_min: geplant || 480,
          trend,
          trend_delta:         delta,
          ampel:               ampelVon(min),
        };
      });

    if (driverList.length === 0) return NextResponse.json(mockResponse(locationId));

    const sorted = driverList.sort((a, b) => b.ueberstunden_min - a.ueberstunden_min);
    const fahrer = sorted.map((f, i) => ({ ...f, rang: i + 1 }));
    const team_avg_ueberstunden = fahrer.length > 0
      ? Math.round(fahrer.reduce((s, f) => s + f.ueberstunden_min, 0) / fahrer.length)
      : 0;
    const alert_count = fahrer.filter(f => f.ueberstunden_min > 45).length;

    return NextResponse.json({
      location_id: locationId,
      fahrer,
      team_avg_ueberstunden,
      alert_count,
      generiert_am: new Date().toISOString(),
    } satisfies FahrerUeberstunden2666Antwort);
  } catch {
    return NextResponse.json(mockResponse(locationId));
  }
}
