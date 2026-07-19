/**
 * GET /api/delivery/admin/fahrer-storno-rate?location_id=<uuid>[&driver_id=<uuid>]
 *
 * Phase 2539 — Fahrer-Storno-Rate
 * Storno-Rate (%) je Fahrer heute (stornierte / angebotene Touren × 100);
 * Ampel grün(≤5%)/gelb(5–15%)/rot(>15%); Alert >15%; Trend vs. Vorwoche;
 * driver_id-Modus; Multi-Tenant; Supabase+Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALERT_PCT = 15;
const GELB_PCT = 5;

export type TrendStorno = 'steigend' | 'fallend' | 'stabil';
export type AmpelStorno = 'gruen' | 'gelb' | 'rot';

export interface FahrerStornoEntry {
  fahrer_id: string;
  fahrer_name: string;
  storno_rate_pct: number;
  storno_rate_vw: number | null;
  angebotene_touren: number;
  stornierte_touren: number;
  trend: TrendStorno;
  trend_delta: number;
  ampel: AmpelStorno;
  alert: boolean;
}

export interface FahrerStornoAntwort {
  location_id: string;
  fahrer: FahrerStornoEntry[];
  fahrer_single?: FahrerStornoEntry;
  team_avg_storno_rate_pct: number;
  alert_count: number;
  generiert_am: string;
}

function ampelVon(pct: number): AmpelStorno {
  if (pct > ALERT_PCT) return 'rot';
  if (pct > GELB_PCT) return 'gelb';
  return 'gruen';
}

function trendVon(heute: number, vw: number | null): { trend: TrendStorno; delta: number } {
  if (vw === null) return { trend: 'stabil', delta: 0 };
  const delta = Math.round((heute - vw) * 10) / 10;
  if (delta > 1) return { trend: 'steigend', delta };
  if (delta < -1) return { trend: 'fallend', delta };
  return { trend: 'stabil', delta };
}

const MOCK_FAHRER: FahrerStornoEntry[] = [
  { fahrer_id: 'mock-f1', fahrer_name: 'Max Müller',     storno_rate_pct: 3.2,  storno_rate_vw: 4.0,  angebotene_touren: 31, stornierte_touren: 1,  trend: 'fallend',  trend_delta: -0.8, ampel: 'gruen', alert: false },
  { fahrer_id: 'mock-f2', fahrer_name: 'Sarah König',    storno_rate_pct: 18.5, storno_rate_vw: 12.0, angebotene_touren: 27, stornierte_touren: 5,  trend: 'steigend', trend_delta:  6.5, ampel: 'rot',   alert: true  },
  { fahrer_id: 'mock-f3', fahrer_name: 'Lena Schneider', storno_rate_pct: 8.7,  storno_rate_vw: 7.5,  angebotene_touren: 23, stornierte_touren: 2,  trend: 'steigend', trend_delta:  1.2, ampel: 'gelb',  alert: false },
  { fahrer_id: 'mock-f4', fahrer_name: 'Tom Becker',     storno_rate_pct: 2.1,  storno_rate_vw: 3.0,  angebotene_touren: 48, stornierte_touren: 1,  trend: 'fallend',  trend_delta: -0.9, ampel: 'gruen', alert: false },
  { fahrer_id: 'mock-f5', fahrer_name: 'Jana Fischer',   storno_rate_pct: 21.4, storno_rate_vw: 18.0, angebotene_touren: 14, stornierte_touren: 3,  trend: 'steigend', trend_delta:  3.4, ampel: 'rot',   alert: true  },
];

function mockAntwort(locationId: string, driverId?: string | null): FahrerStornoAntwort {
  const fahrer = MOCK_FAHRER;
  const alertCount = fahrer.filter(f => f.alert).length;
  const teamAvg = Math.round((fahrer.reduce((s, f) => s + f.storno_rate_pct, 0) / fahrer.length) * 10) / 10;
  if (driverId) {
    const single = fahrer.find(f => f.fahrer_id === driverId) ?? fahrer[0];
    return { location_id: locationId, fahrer, fahrer_single: single, team_avg_storno_rate_pct: teamAvg, alert_count: alertCount, generiert_am: new Date().toISOString() };
  }
  return { location_id: locationId, fahrer, team_avg_storno_rate_pct: teamAvg, alert_count: alertCount, generiert_am: new Date().toISOString() };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const driverId = searchParams.get('driver_id');

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

    const ids = employees.map((e) => e.id);

    const { data: assignmentsHeuteRaw } = await supabase
      .from('delivery_assignments')
      .select('driver_id, status')
      .in('driver_id', ids)
      .eq('location_id', locationId)
      .gte('created_at', todayStart.toISOString())
      .lte('created_at', todayEnd.toISOString());

    const { data: assignmentsVwRaw } = await supabase
      .from('delivery_assignments')
      .select('driver_id, status')
      .in('driver_id', ids)
      .eq('location_id', locationId)
      .gte('created_at', vwStart.toISOString())
      .lte('created_at', vwEnd.toISOString());

    const assignmentsHeute = (assignmentsHeuteRaw ?? []) as { driver_id: string; status: string }[];
    const assignmentsVw    = (assignmentsVwRaw    ?? []) as { driver_id: string; status: string }[];

    const fahrer: FahrerStornoEntry[] = employees.map((emp) => {
      const mineH = assignmentsHeute.filter((a) => a.driver_id === emp.id);
      const mineV = assignmentsVw.filter((a) => a.driver_id === emp.id);

      const angeboten = mineH.length;
      const storniert = mineH.filter((a) => a.status === 'cancelled' || a.status === 'rejected').length;
      const rate = angeboten > 0 ? Math.round((storniert / angeboten) * 1000) / 10 : 0;

      const angebotenVw = mineV.length;
      const stornoVw = mineV.filter((a) => a.status === 'cancelled' || a.status === 'rejected').length;
      const rateVw = angebotenVw > 0 ? Math.round((stornoVw / angebotenVw) * 1000) / 10 : null;

      const { trend, delta } = trendVon(rate, rateVw);
      const ampel = ampelVon(rate);

      return {
        fahrer_id: emp.id,
        fahrer_name: `${emp.vorname} ${emp.nachname}`,
        storno_rate_pct: rate,
        storno_rate_vw: rateVw,
        angebotene_touren: angeboten,
        stornierte_touren: storniert,
        trend,
        trend_delta: delta,
        ampel,
        alert: ampel === 'rot',
      };
    });

    const alertCount = fahrer.filter((f) => f.alert).length;
    const teamAvg = fahrer.length > 0
      ? Math.round((fahrer.reduce((s, f) => s + f.storno_rate_pct, 0) / fahrer.length) * 10) / 10
      : 0;

    const antwort: FahrerStornoAntwort = {
      location_id: locationId,
      fahrer,
      team_avg_storno_rate_pct: teamAvg,
      alert_count: alertCount,
      generiert_am: new Date().toISOString(),
    };

    if (driverId) {
      antwort.fahrer_single = fahrer.find((f) => f.fahrer_id === driverId) ?? fahrer[0];
    }

    return NextResponse.json(antwort);
  } catch {
    return NextResponse.json(mockAntwort(locationId, driverId));
  }
}
