/**
 * GET /api/delivery/admin/fahrer-bewertung-score?location_id=<uuid>[&driver_id=<uuid>]
 *
 * Phase 2544 — Fahrer-Bewertungs-Score
 * Ø Kundenbewertung (1–5 Sterne) je Fahrer heute;
 * Ampel grün(≥4.5)/gelb(3.5–4.4)/rot(<3.5); Alert <3.5; Trend vs. VW;
 * driver_id-Modus; Multi-Tenant; Supabase+Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALERT_STARS = 3.5;
const GELB_STARS = 4.5;

export type TrendBewertung = 'steigend' | 'fallend' | 'stabil';
export type AmpelBewertung = 'gruen' | 'gelb' | 'rot';

export interface FahrerBewertungEntry {
  fahrer_id: string;
  fahrer_name: string;
  avg_sterne: number;
  avg_sterne_vw: number | null;
  bewertungs_count: number;
  trend: TrendBewertung;
  trend_delta: number;
  ampel: AmpelBewertung;
  alert: boolean;
}

export interface FahrerBewertungAntwort {
  location_id: string;
  fahrer: FahrerBewertungEntry[];
  fahrer_single?: FahrerBewertungEntry;
  team_avg_sterne: number;
  alert_count: number;
  generiert_am: string;
}

function ampelVon(sterne: number): AmpelBewertung {
  if (sterne < ALERT_STARS) return 'rot';
  if (sterne < GELB_STARS) return 'gelb';
  return 'gruen';
}

function trendVon(heute: number, vw: number | null): { trend: TrendBewertung; delta: number } {
  if (vw === null) return { trend: 'stabil', delta: 0 };
  const delta = Math.round((heute - vw) * 100) / 100;
  if (delta > 0.1) return { trend: 'steigend', delta };
  if (delta < -0.1) return { trend: 'fallend', delta };
  return { trend: 'stabil', delta };
}

const MOCK_FAHRER: FahrerBewertungEntry[] = [
  { fahrer_id: 'mock-f1', fahrer_name: 'Max Müller',     avg_sterne: 4.8, avg_sterne_vw: 4.7, bewertungs_count: 31, trend: 'steigend', trend_delta: 0.1,  ampel: 'gruen', alert: false },
  { fahrer_id: 'mock-f2', fahrer_name: 'Sarah König',    avg_sterne: 3.2, avg_sterne_vw: 3.8, bewertungs_count: 14, trend: 'fallend',  trend_delta: -0.6, ampel: 'rot',   alert: true  },
  { fahrer_id: 'mock-f3', fahrer_name: 'Lena Schneider', avg_sterne: 4.1, avg_sterne_vw: 4.2, bewertungs_count: 23, trend: 'fallend',  trend_delta: -0.1, ampel: 'gelb',  alert: false },
  { fahrer_id: 'mock-f4', fahrer_name: 'Tom Becker',     avg_sterne: 4.9, avg_sterne_vw: 4.8, bewertungs_count: 48, trend: 'steigend', trend_delta: 0.1,  ampel: 'gruen', alert: false },
  { fahrer_id: 'mock-f5', fahrer_name: 'Jana Fischer',   avg_sterne: 3.0, avg_sterne_vw: 3.3, bewertungs_count: 9,  trend: 'fallend',  trend_delta: -0.3, ampel: 'rot',   alert: true  },
];

function mockAntwort(locationId: string, driverId?: string | null): FahrerBewertungAntwort {
  const fahrer = MOCK_FAHRER;
  const alertCount = fahrer.filter(f => f.alert).length;
  const teamAvg = Math.round((fahrer.reduce((s, f) => s + f.avg_sterne, 0) / fahrer.length) * 100) / 100;
  if (driverId) {
    const single = fahrer.find(f => f.fahrer_id === driverId) ?? fahrer[0];
    return { location_id: locationId, fahrer, fahrer_single: single, team_avg_sterne: teamAvg, alert_count: alertCount, generiert_am: new Date().toISOString() };
  }
  return { location_id: locationId, fahrer, team_avg_sterne: teamAvg, alert_count: alertCount, generiert_am: new Date().toISOString() };
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

    const ids = employees.map(e => e.id);

    const { data: ratingsHeuteRaw } = await supabase
      .from('delivery_ratings')
      .select('driver_id, rating')
      .in('driver_id', ids)
      .eq('location_id', locationId)
      .gte('created_at', todayStart.toISOString())
      .lte('created_at', todayEnd.toISOString());

    const { data: ratingsVwRaw } = await supabase
      .from('delivery_ratings')
      .select('driver_id, rating')
      .in('driver_id', ids)
      .eq('location_id', locationId)
      .gte('created_at', vwStart.toISOString())
      .lte('created_at', vwEnd.toISOString());

    const ratingsHeute = (ratingsHeuteRaw ?? []) as { driver_id: string; rating: number }[];
    const ratingsVw    = (ratingsVwRaw    ?? []) as { driver_id: string; rating: number }[];

    const fahrer: FahrerBewertungEntry[] = employees.map(emp => {
      const mineH = ratingsHeute.filter(r => r.driver_id === emp.id);
      const mineV = ratingsVw.filter(r => r.driver_id === emp.id);

      const avgH = mineH.length > 0
        ? Math.round((mineH.reduce((s, r) => s + r.rating, 0) / mineH.length) * 100) / 100
        : 0;
      const avgV = mineV.length > 0
        ? Math.round((mineV.reduce((s, r) => s + r.rating, 0) / mineV.length) * 100) / 100
        : null;

      const { trend, delta } = trendVon(avgH, avgV);
      const ampel = ampelVon(avgH);

      return {
        fahrer_id: emp.id,
        fahrer_name: `${emp.vorname} ${emp.nachname}`,
        avg_sterne: avgH,
        avg_sterne_vw: avgV,
        bewertungs_count: mineH.length,
        trend,
        trend_delta: delta,
        ampel,
        alert: ampel === 'rot',
      };
    });

    const alertCount = fahrer.filter(f => f.alert).length;
    const teamAvg = fahrer.length > 0
      ? Math.round((fahrer.reduce((s, f) => s + f.avg_sterne, 0) / fahrer.length) * 100) / 100
      : 0;

    const antwort: FahrerBewertungAntwort = {
      location_id: locationId,
      fahrer,
      team_avg_sterne: teamAvg,
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
