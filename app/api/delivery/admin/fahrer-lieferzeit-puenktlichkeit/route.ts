/**
 * GET /api/delivery/admin/fahrer-lieferzeit-puenktlichkeit?location_id=<uuid>[&driver_id=<uuid>]
 *
 * Phase 2569 — Fahrer-Lieferzeit-Pünktlichkeit
 * % Lieferungen innerhalb zugesagter ETA je Fahrer heute;
 * Ampel grün(≥90%)/gelb(75–89%)/rot(<75%); Alert <75%;
 * Trend vs. VW; driver_id-Modus; Multi-Tenant; Supabase+Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALERT_PCT = 75;
const GRUEN_PCT = 90;

export type TrendLP = 'steigend' | 'fallend' | 'stabil';
export type AmpelLP = 'gruen' | 'gelb' | 'rot';

export interface FahrerLieferzeitPuenktlichkeitEntry {
  fahrer_id: string;
  fahrer_name: string;
  puenktlichkeit_pct: number;
  puenktlichkeit_pct_vw: number | null;
  puenktlich_count: number;
  gesamt_count: number;
  trend: TrendLP;
  trend_delta: number;
  ampel: AmpelLP;
  alert: boolean;
}

export interface FahrerLieferzeitPuenktlichkeitAntwort {
  location_id: string;
  fahrer: FahrerLieferzeitPuenktlichkeitEntry[];
  fahrer_single?: FahrerLieferzeitPuenktlichkeitEntry;
  team_avg_pct: number;
  team_avg_pct_vw: number | null;
  alert_count: number;
  generiert_am: string;
}

function ampelVon(pct: number): AmpelLP {
  if (pct >= GRUEN_PCT) return 'gruen';
  if (pct >= ALERT_PCT) return 'gelb';
  return 'rot';
}

function trendVon(heute: number, vw: number | null): { trend: TrendLP; delta: number } {
  if (vw === null) return { trend: 'stabil', delta: 0 };
  const delta = Math.round((heute - vw) * 10) / 10;
  if (delta > 1) return { trend: 'steigend', delta };
  if (delta < -1) return { trend: 'fallend', delta };
  return { trend: 'stabil', delta };
}

const MOCK_FAHRER: FahrerLieferzeitPuenktlichkeitEntry[] = [
  { fahrer_id: 'mock-f1', fahrer_name: 'Max Müller',     puenktlichkeit_pct: 94.4, puenktlichkeit_pct_vw: 91.0, puenktlich_count: 17, gesamt_count: 18, trend: 'steigend', trend_delta:  3.4, ampel: 'gruen', alert: false },
  { fahrer_id: 'mock-f2', fahrer_name: 'Sarah König',    puenktlichkeit_pct: 66.7, puenktlichkeit_pct_vw: 71.4, puenktlich_count:  8, gesamt_count: 12, trend: 'fallend',  trend_delta: -4.7, ampel: 'rot',   alert: true  },
  { fahrer_id: 'mock-f3', fahrer_name: 'Lena Schneider', puenktlichkeit_pct: 81.8, puenktlichkeit_pct_vw: 83.3, puenktlich_count:  9, gesamt_count: 11, trend: 'fallend',  trend_delta: -1.5, ampel: 'gelb',  alert: false },
  { fahrer_id: 'mock-f4', fahrer_name: 'Tom Becker',     puenktlichkeit_pct: 92.3, puenktlichkeit_pct_vw: 90.0, puenktlich_count: 12, gesamt_count: 13, trend: 'steigend', trend_delta:  2.3, ampel: 'gruen', alert: false },
  { fahrer_id: 'mock-f5', fahrer_name: 'Jana Fischer',   puenktlichkeit_pct: 57.1, puenktlichkeit_pct_vw: 63.6, puenktlich_count:  4, gesamt_count:  7, trend: 'fallend',  trend_delta: -6.5, ampel: 'rot',   alert: true  },
];

function mockAntwort(locationId: string, driverId?: string | null): FahrerLieferzeitPuenktlichkeitAntwort {
  const fahrer = MOCK_FAHRER;
  const alertCount = fahrer.filter(f => f.alert).length;
  const teamAvg = Math.round(fahrer.reduce((s, f) => s + f.puenktlichkeit_pct, 0) / fahrer.length * 10) / 10;
  const teamVw  = Math.round(fahrer.reduce((s, f) => s + (f.puenktlichkeit_pct_vw ?? f.puenktlichkeit_pct), 0) / fahrer.length * 10) / 10;
  const base: FahrerLieferzeitPuenktlichkeitAntwort = {
    location_id: locationId,
    fahrer,
    team_avg_pct: teamAvg,
    team_avg_pct_vw: teamVw,
    alert_count: alertCount,
    generiert_am: new Date().toISOString(),
  };
  if (driverId) {
    base.fahrer_single = fahrer.find(f => f.fahrer_id === driverId) ?? { ...fahrer[0], fahrer_id: driverId };
  }
  return base;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const driverId   = searchParams.get('driver_id');

  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const supabase = await createClient();

    const today = new Date();
    const todayStart = new Date(today); todayStart.setHours(0, 0, 0, 0);
    const todayEnd   = new Date(today); todayEnd.setHours(23, 59, 59, 999);
    const vwStart = new Date(todayStart); vwStart.setDate(vwStart.getDate() - 7);
    const vwEnd   = new Date(todayEnd);   vwEnd.setDate(vwEnd.getDate() - 7);

    const { data: employeesRaw } = await supabase
      .from('employees')
      .select('id, vorname, nachname')
      .eq('location_id', locationId)
      .eq('role', 'fahrer');

    const employees = (employeesRaw ?? []) as { id: string; vorname: string; nachname: string }[];
    if (!employees.length) return NextResponse.json(mockAntwort(locationId, driverId));

    const ids = employees.map(e => e.id);

    // delivery_tours: delivered_at <= estimated_delivery_at => pünktlich
    const { data: toursHeuteRaw } = await supabase
      .from('delivery_tours')
      .select('driver_id, delivered_at, estimated_delivery_at')
      .in('driver_id', ids)
      .eq('location_id', locationId)
      .eq('status', 'delivered')
      .gte('delivered_at', todayStart.toISOString())
      .lte('delivered_at', todayEnd.toISOString())
      .not('estimated_delivery_at', 'is', null);

    const { data: toursVwRaw } = await supabase
      .from('delivery_tours')
      .select('driver_id, delivered_at, estimated_delivery_at')
      .in('driver_id', ids)
      .eq('location_id', locationId)
      .eq('status', 'delivered')
      .gte('delivered_at', vwStart.toISOString())
      .lte('delivered_at', vwEnd.toISOString())
      .not('estimated_delivery_at', 'is', null);

    type TourRow = { driver_id: string; delivered_at: string; estimated_delivery_at: string };
    const toursHeute = (toursHeuteRaw ?? []) as TourRow[];
    const toursVw    = (toursVwRaw    ?? []) as TourRow[];

    function calcPct(tours: TourRow[], dId: string) {
      const mine = tours.filter(t => t.driver_id === dId);
      if (!mine.length) return null;
      const puenktlich = mine.filter(t => new Date(t.delivered_at) <= new Date(t.estimated_delivery_at)).length;
      return Math.round((puenktlich / mine.length) * 1000) / 10;
    }

    const fahrer: FahrerLieferzeitPuenktlichkeitEntry[] = employees.map(emp => {
      const mineH = toursHeute.filter(t => t.driver_id === emp.id);
      const pctH  = mineH.length > 0
        ? Math.round((mineH.filter(t => new Date(t.delivered_at) <= new Date(t.estimated_delivery_at)).length / mineH.length) * 1000) / 10
        : 0;
      const pctV  = calcPct(toursVw, emp.id);

      const { trend, delta } = trendVon(pctH, pctV);
      const ampel = ampelVon(pctH);

      return {
        fahrer_id: emp.id,
        fahrer_name: `${emp.vorname} ${emp.nachname}`,
        puenktlichkeit_pct: pctH,
        puenktlichkeit_pct_vw: pctV,
        puenktlich_count: mineH.filter(t => new Date(t.delivered_at) <= new Date(t.estimated_delivery_at)).length,
        gesamt_count: mineH.length,
        trend,
        trend_delta: delta,
        ampel,
        alert: ampel === 'rot',
      };
    });

    const alertCount = fahrer.filter(f => f.alert).length;
    const teamAvg = fahrer.length > 0
      ? Math.round(fahrer.reduce((s, f) => s + f.puenktlichkeit_pct, 0) / fahrer.length * 10) / 10
      : 0;
    const validVw = fahrer.filter(f => f.puenktlichkeit_pct_vw !== null);
    const teamVw = validVw.length > 0
      ? Math.round(validVw.reduce((s, f) => s + (f.puenktlichkeit_pct_vw ?? 0), 0) / validVw.length * 10) / 10
      : null;

    const antwort: FahrerLieferzeitPuenktlichkeitAntwort = {
      location_id: locationId,
      fahrer,
      team_avg_pct: teamAvg,
      team_avg_pct_vw: teamVw,
      alert_count: alertCount,
      generiert_am: new Date().toISOString(),
    };
    if (driverId) {
      antwort.fahrer_single = fahrer.find(f => f.fahrer_id === driverId) ?? fahrer[0];
    }

    return NextResponse.json(antwort);
  } catch {
    return NextResponse.json(mockAntwort(locationId, driverId));
  }
}
