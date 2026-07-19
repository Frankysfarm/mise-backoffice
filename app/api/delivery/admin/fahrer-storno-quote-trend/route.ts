/**
 * GET /api/delivery/admin/fahrer-storno-quote-trend?location_id=<uuid>[&driver_id=<uuid>]
 *
 * Phase 2579 — Fahrer-Storno-Quote-Trend
 * Storno-Quote-Entwicklung je Fahrer (letzte 7 Tage); Trend-Verlauf täglich;
 * Ampel grün(≤5%)/gelb(6–15%)/rot(>15%); Alert >15%; Multi-Tenant; Supabase+Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALERT_PCT = 15;
const GRUEN_PCT = 5;

export type AmpelSQT = 'gruen' | 'gelb' | 'rot';
export type TrendSQT = 'steigend' | 'fallend' | 'stabil';

export interface SparkDay {
  datum: string; // YYYY-MM-DD
  storno_quote_pct: number;
}

export interface FahrerStornoQuoteTrendEntry {
  fahrer_id: string;
  fahrer_name: string;
  storno_quote_heute: number;
  storno_quote_gestern: number | null;
  storno_quote_vw: number | null;
  sparkline: SparkDay[];
  trend: TrendSQT;
  trend_delta: number;
  ampel: AmpelSQT;
  alert: boolean;
}

export interface FahrerStornoQuoteTrendAntwort {
  location_id: string;
  fahrer: FahrerStornoQuoteTrendEntry[];
  fahrer_single?: FahrerStornoQuoteTrendEntry;
  team_avg_heute: number;
  team_avg_gestern: number | null;
  alert_count: number;
  generiert_am: string;
}

function ampelVon(pct: number): AmpelSQT {
  if (pct > ALERT_PCT) return 'rot';
  if (pct > GRUEN_PCT) return 'gelb';
  return 'gruen';
}

function trendVon(heute: number, gestern: number | null): { trend: TrendSQT; delta: number } {
  if (gestern === null) return { trend: 'stabil', delta: 0 };
  const delta = Math.round((heute - gestern) * 10) / 10;
  if (delta > 1) return { trend: 'steigend', delta };
  if (delta < -1) return { trend: 'fallend', delta };
  return { trend: 'stabil', delta };
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const MOCK_FAHRER: FahrerStornoQuoteTrendEntry[] = [
  {
    fahrer_id: 'mock-f1', fahrer_name: 'Max Müller',
    storno_quote_heute: 3.2, storno_quote_gestern: 4.1, storno_quote_vw: 4.0,
    sparkline: [
      { datum: '2026-07-13', storno_quote_pct: 5.0 },
      { datum: '2026-07-14', storno_quote_pct: 4.5 },
      { datum: '2026-07-15', storno_quote_pct: 4.8 },
      { datum: '2026-07-16', storno_quote_pct: 3.9 },
      { datum: '2026-07-17', storno_quote_pct: 3.5 },
      { datum: '2026-07-18', storno_quote_pct: 4.1 },
      { datum: '2026-07-19', storno_quote_pct: 3.2 },
    ],
    trend: 'fallend', trend_delta: -0.9, ampel: 'gruen', alert: false,
  },
  {
    fahrer_id: 'mock-f2', fahrer_name: 'Sarah König',
    storno_quote_heute: 18.5, storno_quote_gestern: 15.2, storno_quote_vw: 12.0,
    sparkline: [
      { datum: '2026-07-13', storno_quote_pct: 10.0 },
      { datum: '2026-07-14', storno_quote_pct: 11.5 },
      { datum: '2026-07-15', storno_quote_pct: 13.0 },
      { datum: '2026-07-16', storno_quote_pct: 14.2 },
      { datum: '2026-07-17', storno_quote_pct: 14.8 },
      { datum: '2026-07-18', storno_quote_pct: 15.2 },
      { datum: '2026-07-19', storno_quote_pct: 18.5 },
    ],
    trend: 'steigend', trend_delta: 3.3, ampel: 'rot', alert: true,
  },
  {
    fahrer_id: 'mock-f3', fahrer_name: 'Lena Schneider',
    storno_quote_heute: 8.7, storno_quote_gestern: 9.5, storno_quote_vw: 7.5,
    sparkline: [
      { datum: '2026-07-13', storno_quote_pct: 7.0 },
      { datum: '2026-07-14', storno_quote_pct: 7.5 },
      { datum: '2026-07-15', storno_quote_pct: 8.0 },
      { datum: '2026-07-16', storno_quote_pct: 9.0 },
      { datum: '2026-07-17', storno_quote_pct: 9.8 },
      { datum: '2026-07-18', storno_quote_pct: 9.5 },
      { datum: '2026-07-19', storno_quote_pct: 8.7 },
    ],
    trend: 'fallend', trend_delta: -0.8, ampel: 'gelb', alert: false,
  },
  {
    fahrer_id: 'mock-f4', fahrer_name: 'Tom Becker',
    storno_quote_heute: 2.1, storno_quote_gestern: 2.5, storno_quote_vw: 3.0,
    sparkline: [
      { datum: '2026-07-13', storno_quote_pct: 3.5 },
      { datum: '2026-07-14', storno_quote_pct: 3.0 },
      { datum: '2026-07-15', storno_quote_pct: 2.8 },
      { datum: '2026-07-16', storno_quote_pct: 2.5 },
      { datum: '2026-07-17', storno_quote_pct: 2.3 },
      { datum: '2026-07-18', storno_quote_pct: 2.5 },
      { datum: '2026-07-19', storno_quote_pct: 2.1 },
    ],
    trend: 'fallend', trend_delta: -0.4, ampel: 'gruen', alert: false,
  },
  {
    fahrer_id: 'mock-f5', fahrer_name: 'Jana Fischer',
    storno_quote_heute: 21.4, storno_quote_gestern: 19.0, storno_quote_vw: 18.0,
    sparkline: [
      { datum: '2026-07-13', storno_quote_pct: 15.0 },
      { datum: '2026-07-14', storno_quote_pct: 16.0 },
      { datum: '2026-07-15', storno_quote_pct: 17.5 },
      { datum: '2026-07-16', storno_quote_pct: 18.2 },
      { datum: '2026-07-17', storno_quote_pct: 18.9 },
      { datum: '2026-07-18', storno_quote_pct: 19.0 },
      { datum: '2026-07-19', storno_quote_pct: 21.4 },
    ],
    trend: 'steigend', trend_delta: 2.4, ampel: 'rot', alert: true,
  },
];

function mockAntwort(locationId: string, driverId?: string | null): FahrerStornoQuoteTrendAntwort {
  const alertCount = MOCK_FAHRER.filter(f => f.alert).length;
  const teamAvg = Math.round(MOCK_FAHRER.reduce((s, f) => s + f.storno_quote_heute, 0) / MOCK_FAHRER.length * 10) / 10;
  const teamGestern = Math.round(MOCK_FAHRER.reduce((s, f) => s + (f.storno_quote_gestern ?? f.storno_quote_heute), 0) / MOCK_FAHRER.length * 10) / 10;
  const base: FahrerStornoQuoteTrendAntwort = {
    location_id: locationId,
    fahrer: MOCK_FAHRER,
    team_avg_heute: teamAvg,
    team_avg_gestern: teamGestern,
    alert_count: alertCount,
    generiert_am: new Date().toISOString(),
  };
  if (driverId) {
    base.fahrer_single = MOCK_FAHRER.find(f => f.fahrer_id === driverId) ?? { ...MOCK_FAHRER[0], fahrer_id: driverId };
  }
  return base;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const driverId = searchParams.get('driver_id');

  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const supabase = await createClient();

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    // Build 7-day date buckets
    const days: { label: string; start: Date; end: Date }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const start = new Date(d); start.setHours(0, 0, 0, 0);
      const end   = new Date(d); end.setHours(23, 59, 59, 999);
      days.push({ label: formatDate(start), start, end });
    }

    const rangeStart = days[0].start;

    const { data: employeesRaw } = await supabase
      .from('employees')
      .select('id, vorname, nachname')
      .eq('location_id', locationId)
      .eq('role', 'fahrer');

    const employees = (employeesRaw ?? []) as { id: string; vorname: string; nachname: string }[];
    if (!employees.length) return NextResponse.json(mockAntwort(locationId, driverId));

    const ids = employees.map(e => e.id);

    const { data: assignmentsRaw } = await supabase
      .from('delivery_assignments')
      .select('driver_id, status, created_at')
      .in('driver_id', ids)
      .eq('location_id', locationId)
      .gte('created_at', rangeStart.toISOString())
      .lte('created_at', today.toISOString());

    type AssRow = { driver_id: string; status: string; created_at: string };
    const assignments = (assignmentsRaw ?? []) as AssRow[];

    const fahrer: FahrerStornoQuoteTrendEntry[] = employees.map(emp => {
      const mine = assignments.filter(a => a.driver_id === emp.id);

      const sparkline: SparkDay[] = days.map(day => {
        const dayItems = mine.filter(a => {
          const d = new Date(a.created_at);
          return d >= day.start && d <= day.end;
        });
        const total   = dayItems.length;
        const storno  = dayItems.filter(a => a.status === 'cancelled' || a.status === 'rejected').length;
        const pct     = total > 0 ? Math.round((storno / total) * 1000) / 10 : 0;
        return { datum: day.label, storno_quote_pct: pct };
      });

      const heute     = sparkline[6].storno_quote_pct;
      const gestern   = sparkline[5].storno_quote_pct;
      const vwDay     = sparkline[0].storno_quote_pct;

      const { trend, delta } = trendVon(heute, gestern);
      const ampel = ampelVon(heute);

      return {
        fahrer_id: emp.id,
        fahrer_name: `${emp.vorname} ${emp.nachname}`,
        storno_quote_heute: heute,
        storno_quote_gestern: gestern,
        storno_quote_vw: vwDay,
        sparkline,
        trend,
        trend_delta: delta,
        ampel,
        alert: ampel === 'rot',
      };
    });

    const alertCount = fahrer.filter(f => f.alert).length;
    const teamAvg = fahrer.length > 0
      ? Math.round(fahrer.reduce((s, f) => s + f.storno_quote_heute, 0) / fahrer.length * 10) / 10
      : 0;
    const teamGestern = fahrer.length > 0
      ? Math.round(fahrer.reduce((s, f) => s + (f.storno_quote_gestern ?? 0), 0) / fahrer.length * 10) / 10
      : null;

    const antwort: FahrerStornoQuoteTrendAntwort = {
      location_id: locationId,
      fahrer,
      team_avg_heute: teamAvg,
      team_avg_gestern: teamGestern,
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
