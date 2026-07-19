/**
 * GET /api/delivery/admin/fahrer-lieferzeit-abweichung?location_id=<uuid>[&driver_id=<uuid>]
 *
 * Phase 2574 — Fahrer-Lieferzeit-Abweichung
 * Ø Abweichung in Min von zugesagter ETA je Fahrer heute
 * (delivered_at - estimated_delivery_at; negativ = früher, positiv = später);
 * Ampel grün(≤0 Min)/gelb(1–10 Min)/rot(>10 Min); Alert >10 Min;
 * Trend vs. VW; driver_id-Modus; Multi-Tenant; Supabase+Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALERT_MIN   = 10;
const GELB_MIN    = 1;

export type TrendLA = 'besser' | 'schlechter' | 'stabil';
export type AmpelLA = 'gruen' | 'gelb' | 'rot';

export interface FahrerLieferzeitAbweichungEntry {
  fahrer_id: string;
  fahrer_name: string;
  abweichung_min: number;
  abweichung_min_vw: number | null;
  lieferungen_count: number;
  trend: TrendLA;
  trend_delta: number;
  ampel: AmpelLA;
  alert: boolean;
}

export interface FahrerLieferzeitAbweichungAntwort {
  location_id: string;
  fahrer: FahrerLieferzeitAbweichungEntry[];
  fahrer_single?: FahrerLieferzeitAbweichungEntry;
  team_avg_min: number;
  team_avg_min_vw: number | null;
  alert_count: number;
  generiert_am: string;
}

function ampelVon(min: number): AmpelLA {
  if (min <= 0)          return 'gruen';
  if (min <= ALERT_MIN)  return 'gelb';
  return 'rot';
}

function trendVon(heute: number, vw: number | null): { trend: TrendLA; delta: number } {
  if (vw === null) return { trend: 'stabil', delta: 0 };
  const delta = Math.round((heute - vw) * 10) / 10;
  if (delta < -0.5) return { trend: 'besser', delta };
  if (delta >  0.5) return { trend: 'schlechter', delta };
  return { trend: 'stabil', delta };
}

const MOCK_FAHRER: FahrerLieferzeitAbweichungEntry[] = [
  { fahrer_id: 'mock-f1', fahrer_name: 'Max Müller',     abweichung_min: -1.2, abweichung_min_vw:  0.5, lieferungen_count: 18, trend: 'besser',     trend_delta: -1.7, ampel: 'gruen', alert: false },
  { fahrer_id: 'mock-f2', fahrer_name: 'Sarah König',    abweichung_min: 14.3, abweichung_min_vw: 11.8, lieferungen_count: 12, trend: 'schlechter', trend_delta:  2.5, ampel: 'rot',   alert: true  },
  { fahrer_id: 'mock-f3', fahrer_name: 'Lena Schneider', abweichung_min:  6.1, abweichung_min_vw:  7.4, lieferungen_count: 11, trend: 'besser',     trend_delta: -1.3, ampel: 'gelb',  alert: false },
  { fahrer_id: 'mock-f4', fahrer_name: 'Tom Becker',     abweichung_min:  2.4, abweichung_min_vw:  2.1, lieferungen_count: 13, trend: 'stabil',     trend_delta:  0.3, ampel: 'gelb',  alert: false },
  { fahrer_id: 'mock-f5', fahrer_name: 'Jana Fischer',   abweichung_min: 18.7, abweichung_min_vw: 14.2, lieferungen_count:  7, trend: 'schlechter', trend_delta:  4.5, ampel: 'rot',   alert: true  },
];

function mockAntwort(locationId: string, driverId?: string | null): FahrerLieferzeitAbweichungAntwort {
  const fahrer = MOCK_FAHRER;
  const alertCount = fahrer.filter(f => f.alert).length;
  const teamAvg = Math.round(fahrer.reduce((s, f) => s + f.abweichung_min, 0) / fahrer.length * 10) / 10;
  const teamVw  = Math.round(fahrer.reduce((s, f) => s + (f.abweichung_min_vw ?? f.abweichung_min), 0) / fahrer.length * 10) / 10;
  const base: FahrerLieferzeitAbweichungAntwort = {
    location_id: locationId,
    fahrer,
    team_avg_min: teamAvg,
    team_avg_min_vw: teamVw,
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

    // abweichung = (delivered_at - estimated_delivery_at) in minutes
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

    function calcAvgAbweichung(tours: TourRow[], dId: string): number | null {
      const mine = tours.filter(t => t.driver_id === dId);
      if (!mine.length) return null;
      const total = mine.reduce((s, t) => {
        const diff = (new Date(t.delivered_at).getTime() - new Date(t.estimated_delivery_at).getTime()) / 60000;
        return s + diff;
      }, 0);
      return Math.round((total / mine.length) * 10) / 10;
    }

    const fahrer: FahrerLieferzeitAbweichungEntry[] = employees.map(emp => {
      const avgH = calcAvgAbweichung(toursHeute, emp.id) ?? 0;
      const avgV = calcAvgAbweichung(toursVw, emp.id);
      const mineH = toursHeute.filter(t => t.driver_id === emp.id);

      const { trend, delta } = trendVon(avgH, avgV);
      const ampel = ampelVon(avgH);

      return {
        fahrer_id: emp.id,
        fahrer_name: `${emp.vorname} ${emp.nachname}`,
        abweichung_min: avgH,
        abweichung_min_vw: avgV,
        lieferungen_count: mineH.length,
        trend,
        trend_delta: delta,
        ampel,
        alert: ampel === 'rot',
      };
    });

    const alertCount = fahrer.filter(f => f.alert).length;
    const teamAvg = fahrer.length > 0
      ? Math.round(fahrer.reduce((s, f) => s + f.abweichung_min, 0) / fahrer.length * 10) / 10
      : 0;
    const validVw = fahrer.filter(f => f.abweichung_min_vw !== null);
    const teamVw = validVw.length > 0
      ? Math.round(validVw.reduce((s, f) => s + (f.abweichung_min_vw ?? 0), 0) / validVw.length * 10) / 10
      : null;

    const antwort: FahrerLieferzeitAbweichungAntwort = {
      location_id: locationId,
      fahrer,
      team_avg_min: teamAvg,
      team_avg_min_vw: teamVw,
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
