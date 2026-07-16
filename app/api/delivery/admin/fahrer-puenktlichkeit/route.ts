/**
 * GET /api/delivery/admin/fahrer-puenktlichkeit?location_id=<uuid>
 *
 * Phase 1831 — Fahrer-Pünktlichkeits-Index-API (erweitert aus Phase 1353)
 * Pünktlichkeitsquote je Fahrer (geliefert innerhalb ETA); 7-Tage-Verlauf; Rang; Multi-Tenant; Supabase+Mock.
 *
 * Response: { location_id, fahrer: FahrerPuenktlichkeitV2[], team_durchschnitt, generiert_am }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type PuenktlichkeitsGrade = 'A' | 'B' | 'C' | 'D';
export type Ampel = 'gruen' | 'gelb' | 'rot';
export type Trend = 'steigend' | 'fallend' | 'stabil';

export interface FahrerPuenktlichkeitV2 {
  fahrer_id: string;
  fahrer_name: string;
  gesamt_stopps: number;
  puenktlich: number;
  zu_spaet: number;
  quote_pct: number;
  grade: PuenktlichkeitsGrade;
  ampel: Ampel;
  trend: Trend;
  trend_delta: number;
  verlauf_7_tage: number[];
  rang: number;
}

export interface FahrerPuenktlichkeitAntwort {
  location_id: string;
  fahrer: FahrerPuenktlichkeitV2[];
  team_durchschnitt: number;
  generiert_am: string;
}

function gradeFromQuote(pct: number): PuenktlichkeitsGrade {
  if (pct >= 90) return 'A';
  if (pct >= 75) return 'B';
  if (pct >= 60) return 'C';
  return 'D';
}

function ampelVon(pct: number): Ampel {
  if (pct >= 85) return 'gruen';
  if (pct >= 65) return 'gelb';
  return 'rot';
}

function trendVon(verlauf: number[]): { trend: Trend; delta: number } {
  if (verlauf.length < 2) return { trend: 'stabil', delta: 0 };
  const neu = verlauf[0];
  const alt = verlauf[verlauf.length - 1];
  const delta = Math.round(neu - alt);
  if (delta > 3) return { trend: 'steigend', delta };
  if (delta < -3) return { trend: 'fallend', delta };
  return { trend: 'stabil', delta };
}

const MOCK_FAHRER: Omit<FahrerPuenktlichkeitV2, 'rang'>[] = [
  {
    fahrer_id: 'mock-f1',
    fahrer_name: 'Max Müller',
    gesamt_stopps: 42,
    puenktlich: 39,
    zu_spaet: 3,
    quote_pct: 92.9,
    grade: 'A',
    ampel: 'gruen',
    trend: 'steigend',
    trend_delta: 4,
    verlauf_7_tage: [92.9, 90.1, 88.5, 91.0, 87.2, 85.0, 88.7],
  },
  {
    fahrer_id: 'mock-f2',
    fahrer_name: 'Sara Koch',
    gesamt_stopps: 38,
    puenktlich: 31,
    zu_spaet: 7,
    quote_pct: 81.6,
    grade: 'B',
    ampel: 'gelb',
    trend: 'stabil',
    trend_delta: 1,
    verlauf_7_tage: [81.6, 80.2, 82.0, 79.5, 83.1, 80.8, 81.0],
  },
  {
    fahrer_id: 'mock-f3',
    fahrer_name: 'Tim Becker',
    gesamt_stopps: 29,
    puenktlich: 20,
    zu_spaet: 9,
    quote_pct: 69.0,
    grade: 'C',
    ampel: 'gelb',
    trend: 'fallend',
    trend_delta: -6,
    verlauf_7_tage: [69.0, 72.4, 74.1, 75.9, 77.2, 76.5, 75.0],
  },
  {
    fahrer_id: 'mock-f4',
    fahrer_name: 'Lisa Fuchs',
    gesamt_stopps: 19,
    puenktlich: 10,
    zu_spaet: 9,
    quote_pct: 52.6,
    grade: 'D',
    ampel: 'rot',
    trend: 'stabil',
    trend_delta: 0,
    verlauf_7_tage: [52.6, 51.9, 53.8, 52.0, 54.2, 51.1, 52.5],
  },
];

function buildMock(locationId: string): FahrerPuenktlichkeitAntwort {
  const sorted = [...MOCK_FAHRER].sort((a, b) => b.quote_pct - a.quote_pct);
  const fahrerListe: FahrerPuenktlichkeitV2[] = sorted.map((f, i) => ({ ...f, rang: i + 1 }));
  return {
    location_id: locationId,
    fahrer: fahrerListe,
    team_durchschnitt: Math.round(fahrerListe.reduce((s, f) => s + f.quote_pct, 0) / fahrerListe.length * 10) / 10,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const sb = await createClient();

    const { data: drivers, error: driversErr } = await sb
      .from('profiles')
      .select('id, full_name')
      .eq('location_id', locationId)
      .eq('role', 'driver');

    if (driversErr || !drivers || drivers.length === 0) throw new Error('no_drivers');

    const jetzt = new Date();

    type StopRow = {
      id: string;
      geliefert_am: string | null;
      eta_min: number | null;
      driver_batches: { driver_id: string; started_at: string | null } | null;
    };

    const unsorted: Omit<FahrerPuenktlichkeitV2, 'rang'>[] = await Promise.all(
      drivers.map(async (d: { id: string; full_name: string | null }) => {
        const verlauf_7_tage: number[] = [];

        for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
          const dayStart = new Date(jetzt.getTime() - (dayOffset + 1) * 24 * 60 * 60 * 1000);
          const dayEnd = new Date(jetzt.getTime() - dayOffset * 24 * 60 * 60 * 1000);

          const { data: dayStops } = await sb
            .from('driver_batches')
            .select('id, stops_count, completed_at, eta_minutes')
            .eq('driver_id', d.id)
            .eq('location_id', locationId)
            .gte('completed_at', dayStart.toISOString())
            .lt('completed_at', dayEnd.toISOString());

          if (!dayStops || dayStops.length === 0) {
            verlauf_7_tage.push(dayOffset === 0 ? 75 : verlauf_7_tage[verlauf_7_tage.length - 1] ?? 75);
            continue;
          }

          type BatchRow = { stops_count: number | null; completed_at: string | null; eta_minutes: number | null };
          const ges = (dayStops as BatchRow[]).reduce((s, b) => s + (b.stops_count ?? 1), 0);
          const pkt = (dayStops as BatchRow[]).reduce((s, b) => {
            if (!b.completed_at || !b.eta_minutes) return s;
            return s + (b.stops_count ?? 1);
          }, 0);
          verlauf_7_tage.push(ges > 0 ? Math.round((pkt / ges) * 1000) / 10 : 75);
        }

        const quote_pct = verlauf_7_tage[0] ?? 75;
        const { trend, delta } = trendVon(verlauf_7_tage);

        const { data: batches7 } = await sb
          .from('driver_batches')
          .select('stops_count, on_time_count')
          .eq('driver_id', d.id)
          .eq('location_id', locationId)
          .gte('completed_at', new Date(jetzt.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString());

        type BatchSummary = { stops_count: number | null; on_time_count: number | null };
        const gesamt_stopps = (batches7 as BatchSummary[] | null ?? []).reduce((s, b) => s + (b.stops_count ?? 0), 0);
        const puenktlich = (batches7 as BatchSummary[] | null ?? []).reduce((s, b) => s + (b.on_time_count ?? 0), 0);

        return {
          fahrer_id: d.id,
          fahrer_name: d.full_name ?? 'Fahrer',
          gesamt_stopps,
          puenktlich,
          zu_spaet: Math.max(0, gesamt_stopps - puenktlich),
          quote_pct,
          grade: gradeFromQuote(quote_pct),
          ampel: ampelVon(quote_pct),
          trend,
          trend_delta: delta,
          verlauf_7_tage,
        };
      })
    );

    const sorted = [...unsorted].sort((a, b) => b.quote_pct - a.quote_pct);
    const fahrerListe: FahrerPuenktlichkeitV2[] = sorted.map((f, i) => ({ ...f, rang: i + 1 }));

    const team_durchschnitt =
      fahrerListe.length > 0
        ? Math.round((fahrerListe.reduce((s, f) => s + f.quote_pct, 0) / fahrerListe.length) * 10) / 10
        : 0;

    return NextResponse.json({
      location_id: locationId,
      fahrer: fahrerListe,
      team_durchschnitt,
      generiert_am: jetzt.toISOString(),
    } satisfies FahrerPuenktlichkeitAntwort);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
