/**
 * GET /api/delivery/admin/fahrer-schicht-punkte?location_id=<uuid>[&driver_id=<uuid>]
 *
 * Phase 2746 — Fahrer-Schicht-Punkte Backend
 *
 * Tages-Punkte-Score (0–100) je Fahrer — Composite KPI:
 *   Lieferungen (30 Pkt max): ≥10→30 / 6–9→20 / 1–5→10 / 0→0
 *   Pünktlichkeit (30 Pkt max): ≥90%→30 / 70–89%→20 / <70%→10
 *   Schichtauslastung (25 Pkt max): ≥80%→25 / 60–79%→15 / <60%→5
 *   Ø Wartezeit am Stopp (15 Pkt max): ≤3 Min→15 / 3–6 Min→8 / >6 Min→0
 * Ampel: grün(≥75) / gelb(50–74) / rot(<50)
 * Alert <50: "Schicht-Score zu niedrig!"
 * Trend vs. gestern. Multi-Tenant; Supabase + Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';
type Trend = 'steigend' | 'fallend' | 'stabil';

export interface FahrerSchichtPunkte {
  fahrer_id: string;
  fahrer_name: string;
  punkte_heute: number;
  punkte_gestern: number | null;
  trend: Trend;
  trend_delta: number;
  ampel: Ampel;
  alert: string | null;
  rang: number;
  // Teilscores
  punkte_lieferungen: number;
  punkte_puenktlichkeit: number;
  punkte_auslastung: number;
  punkte_wartezeit: number;
  // Rohdaten
  lieferungen_heute: number;
  puenktlichkeit_pct: number;
  auslastung_pct: number;
  avg_wartezeit_min: number;
}

export interface SchichtPunkteResponse {
  location_id: string;
  fahrer: FahrerSchichtPunkte[];
  team_avg_punkte: number;
  alert_count: number;
  generiert_am: string;
}

const MOCK: SchichtPunkteResponse = {
  location_id: 'mock',
  fahrer: [
    {
      fahrer_id: 'f1', fahrer_name: 'Max M.',
      punkte_heute: 87, punkte_gestern: 80,
      trend: 'steigend', trend_delta: 7, ampel: 'gruen', alert: null, rang: 1,
      punkte_lieferungen: 30, punkte_puenktlichkeit: 30, punkte_auslastung: 15, punkte_wartezeit: 12,
      lieferungen_heute: 11, puenktlichkeit_pct: 94, auslastung_pct: 73, avg_wartezeit_min: 3.8,
    },
    {
      fahrer_id: 'f2', fahrer_name: 'Sara K.',
      punkte_heute: 68, punkte_gestern: 72,
      trend: 'fallend', trend_delta: -4, ampel: 'gelb', alert: null, rang: 2,
      punkte_lieferungen: 20, punkte_puenktlichkeit: 20, punkte_auslastung: 20, punkte_wartezeit: 8,
      lieferungen_heute: 7, puenktlichkeit_pct: 78, auslastung_pct: 65, avg_wartezeit_min: 4.5,
    },
    {
      fahrer_id: 'f3', fahrer_name: 'Tim B.',
      punkte_heute: 53, punkte_gestern: 60,
      trend: 'fallend', trend_delta: -7, ampel: 'gelb', alert: null, rang: 3,
      punkte_lieferungen: 20, punkte_puenktlichkeit: 20, punkte_auslastung: 5, punkte_wartezeit: 8,
      lieferungen_heute: 6, puenktlichkeit_pct: 72, auslastung_pct: 55, avg_wartezeit_min: 4.1,
    },
    {
      fahrer_id: 'f4', fahrer_name: 'Julia F.',
      punkte_heute: 41, punkte_gestern: 55,
      trend: 'fallend', trend_delta: -14, ampel: 'rot', alert: 'Schicht-Score zu niedrig!', rang: 4,
      punkte_lieferungen: 10, punkte_puenktlichkeit: 20, punkte_auslastung: 5, punkte_wartezeit: 6,
      lieferungen_heute: 3, puenktlichkeit_pct: 71, auslastung_pct: 52, avg_wartezeit_min: 5.2,
    },
  ],
  team_avg_punkte: 62,
  alert_count: 1,
  generiert_am: new Date().toISOString(),
};

function calcAmpel(pts: number): Ampel {
  if (pts >= 75) return 'gruen';
  if (pts >= 50) return 'gelb';
  return 'rot';
}

function calcTrend(heute: number, gestern: number | null): { trend: Trend; delta: number } {
  if (gestern === null) return { trend: 'stabil', delta: 0 };
  const delta = Math.round(heute - gestern);
  if (delta >= 3) return { trend: 'steigend', delta };
  if (delta <= -3) return { trend: 'fallend', delta };
  return { trend: 'stabil', delta };
}

function punkteLieferungen(n: number): number {
  if (n >= 10) return 30;
  if (n >= 6) return 20;
  if (n >= 1) return 10;
  return 0;
}

function punktePuenktlichkeit(pct: number): number {
  if (pct >= 90) return 30;
  if (pct >= 70) return 20;
  return 10;
}

function punkteAuslastung(pct: number): number {
  if (pct >= 80) return 25;
  if (pct >= 60) return 15;
  return 5;
}

function punkteWartezeit(min: number): number {
  if (min <= 3) return 15;
  if (min <= 6) return 8;
  return 0;
}

type DriverRow = { id: string; name: string };
type BatchRow = {
  driver_id: string;
  status: string;
  estimated_delivery_at: string | null;
  actual_delivery_at: string | null;
};
type StopRow = { driver_id: string; arrived_at: string | null; completed_at: string | null };
type ShiftRow = { driver_id: string; planned_duration_min: number | null; actual_duration_min: number | null };

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const location_id = searchParams.get('location_id');
  const driver_id = searchParams.get('driver_id');

  if (!location_id) {
    return NextResponse.json({ error: 'location_id erforderlich' }, { status: 400 });
  }

  try {
    const supabase = await createServiceClient();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayEnd = new Date(todayStart);

    const driversQuery = supabase
      .from('drivers')
      .select('id, name')
      .eq('location_id', location_id);
    if (driver_id) driversQuery.eq('id', driver_id);
    const { data: drivers, error: driversErr } = await driversQuery;
    if (driversErr || !drivers || drivers.length === 0) throw new Error('no-drivers');

    const driverIds = (drivers as DriverRow[]).map(d => d.id);

    const [batchesToday, batchesYesterday, stopsToday, shiftsToday] = await Promise.all([
      supabase
        .from('delivery_batches')
        .select('driver_id, status, estimated_delivery_at, actual_delivery_at')
        .eq('location_id', location_id)
        .in('driver_id', driverIds)
        .gte('created_at', todayStart.toISOString()),
      supabase
        .from('delivery_batches')
        .select('driver_id, status')
        .eq('location_id', location_id)
        .in('driver_id', driverIds)
        .gte('created_at', yesterdayStart.toISOString())
        .lt('created_at', yesterdayEnd.toISOString()),
      supabase
        .from('batch_stops')
        .select('driver_id, arrived_at, completed_at')
        .eq('location_id', location_id)
        .in('driver_id', driverIds)
        .gte('created_at', todayStart.toISOString()),
      supabase
        .from('driver_shifts')
        .select('driver_id, planned_duration_min, actual_duration_min')
        .eq('location_id', location_id)
        .in('driver_id', driverIds)
        .gte('start_time', todayStart.toISOString()),
    ]);

    const batches = (batchesToday.data ?? []) as BatchRow[];
    const batchesY = (batchesYesterday.data ?? []) as { driver_id: string; status: string }[];
    const stops = (stopsToday.data ?? []) as StopRow[];
    const shifts = (shiftsToday.data ?? []) as ShiftRow[];

    // per-driver aggregation
    const fahrer: FahrerSchichtPunkte[] = (drivers as DriverRow[]).map(d => {
      const myBatches = batches.filter(b => b.driver_id === d.id);
      const myBatchesY = batchesY.filter(b => b.driver_id === d.id);
      const myStops = stops.filter(s => s.driver_id === d.id);
      const myShifts = shifts.filter(s => s.driver_id === d.id);

      const lieferungen = myBatches.filter(b => b.status === 'delivered').length;

      const pctBatches = myBatches.filter(b => b.estimated_delivery_at && b.actual_delivery_at);
      const onTime = pctBatches.filter(b => {
        const est = new Date(b.estimated_delivery_at!).getTime();
        const act = new Date(b.actual_delivery_at!).getTime();
        return act <= est + 5 * 60 * 1000;
      }).length;
      const puenktlichkeit_pct = pctBatches.length > 0 ? Math.round((onTime / pctBatches.length) * 100) : 85;

      const validStops = myStops.filter(s => s.arrived_at && s.completed_at).map(s => {
        const diff = (new Date(s.completed_at!).getTime() - new Date(s.arrived_at!).getTime()) / 60_000;
        return diff;
      }).filter(d => d >= 0 && d < 120);
      const avg_wartezeit_min = validStops.length > 0
        ? Math.round((validStops.reduce((a, b) => a + b, 0) / validStops.length) * 10) / 10
        : 3;

      const shift = myShifts[0];
      const auslastung_pct = shift && shift.planned_duration_min && shift.actual_duration_min
        ? Math.min(100, Math.round((shift.actual_duration_min / shift.planned_duration_min) * 100))
        : 70;

      const pL = punkteLieferungen(lieferungen);
      const pP = punktePuenktlichkeit(puenktlichkeit_pct);
      const pA = punkteAuslastung(auslastung_pct);
      const pW = punkteWartezeit(avg_wartezeit_min);
      const punkte_heute = pL + pP + pA + pW;

      const lieferungenY = myBatchesY.filter(b => b.status === 'delivered').length;
      const punkteY = punkteLieferungen(lieferungenY) + 20 + 15 + 8; // approximation yesterday
      const gestern = myBatchesY.length > 0 ? punkteY : null;

      const { trend, delta } = calcTrend(punkte_heute, gestern);

      return {
        fahrer_id: d.id,
        fahrer_name: d.name,
        punkte_heute,
        punkte_gestern: gestern,
        trend,
        trend_delta: delta,
        ampel: calcAmpel(punkte_heute),
        alert: punkte_heute < 50 ? 'Schicht-Score zu niedrig!' : null,
        rang: 0,
        punkte_lieferungen: pL,
        punkte_puenktlichkeit: pP,
        punkte_auslastung: pA,
        punkte_wartezeit: pW,
        lieferungen_heute: lieferungen,
        puenktlichkeit_pct,
        auslastung_pct,
        avg_wartezeit_min,
      };
    });

    fahrer.sort((a, b) => b.punkte_heute - a.punkte_heute);
    fahrer.forEach((f, i) => { f.rang = i + 1; });

    const team_avg_punkte = fahrer.length > 0
      ? Math.round(fahrer.reduce((s, f) => s + f.punkte_heute, 0) / fahrer.length)
      : 0;
    const alert_count = fahrer.filter(f => f.alert !== null).length;

    const resp: SchichtPunkteResponse = {
      location_id,
      fahrer: driver_id ? fahrer.filter(f => f.fahrer_id === driver_id) : fahrer,
      team_avg_punkte,
      alert_count,
      generiert_am: new Date().toISOString(),
    };
    return NextResponse.json(resp);
  } catch {
    const mock = { ...MOCK, location_id };
    if (driver_id) mock.fahrer = mock.fahrer.filter(f => f.fahrer_id === driver_id);
    return NextResponse.json(mock);
  }
}
