/**
 * GET /api/delivery/admin/fahrer-schicht-qualitaet?location_id=<uuid>
 *
 * Phase 1913 — Fahrer-Schicht-Qualitäts-Score-API
 * Gesamtqualitätsscore je Fahrer aus Pünktlichkeit (40%) + Bewertung (35%) + Stopps (25%);
 * Ampel grün/gelb/rot; Rang; Multi-Tenant; Supabase+Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type Ampel = 'gruen' | 'gelb' | 'rot';
export type Trend = 'steigend' | 'fallend' | 'stabil';

export interface FahrerQualitaetsScore {
  fahrer_id: string;
  fahrer_name: string;
  score: number;
  puenktlichkeit_pct: number;
  bewertung_avg: number;
  stopps_heute: number;
  ampel: Ampel;
  trend: Trend;
  rang: number;
  alert: boolean;
}

export interface FahrerQualitaetsAntwort {
  location_id: string;
  fahrer: FahrerQualitaetsScore[];
  team_durchschnitt: number;
  generiert_am: string;
}

const MOCK_FAHRER: Omit<FahrerQualitaetsScore, 'rang'>[] = [
  { fahrer_id: 'f1', fahrer_name: 'Max M.', score: 88, puenktlichkeit_pct: 92, bewertung_avg: 4.8, stopps_heute: 14, ampel: 'gruen', trend: 'steigend', alert: false },
  { fahrer_id: 'f2', fahrer_name: 'Sara K.', score: 74, puenktlichkeit_pct: 78, bewertung_avg: 4.1, stopps_heute: 10, ampel: 'gelb', trend: 'stabil', alert: false },
  { fahrer_id: 'f3', fahrer_name: 'Luca P.', score: 58, puenktlichkeit_pct: 61, bewertung_avg: 3.5, stopps_heute: 8, ampel: 'rot', trend: 'fallend', alert: true },
  { fahrer_id: 'f4', fahrer_name: 'Anna T.', score: 82, puenktlichkeit_pct: 85, bewertung_avg: 4.5, stopps_heute: 12, ampel: 'gruen', trend: 'stabil', alert: false },
];

function buildMock(locationId: string): FahrerQualitaetsAntwort {
  const sorted = [...MOCK_FAHRER].sort((a, b) => b.score - a.score);
  const fahrer: FahrerQualitaetsScore[] = sorted.map((f, i) => ({ ...f, rang: i + 1 }));
  return {
    location_id: locationId,
    fahrer,
    team_durchschnitt: Math.round(fahrer.reduce((s, f) => s + f.score, 0) / fahrer.length),
    generiert_am: new Date().toISOString(),
  };
}

function scoreBerechnen(puenktlichkeit: number, bewertung: number, stopps: number): number {
  const pktNorm = Math.min(100, puenktlichkeit);
  const bewNorm = Math.min(100, (bewertung / 5) * 100);
  const stoppsNorm = Math.min(100, (stopps / 15) * 100);
  return Math.round(pktNorm * 0.4 + bewNorm * 0.35 + stoppsNorm * 0.25);
}

function ampelVon(score: number): Ampel {
  if (score >= 75) return 'gruen';
  if (score >= 60) return 'gelb';
  return 'rot';
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const sb = await createClient();

    const { data: drivers, error } = await sb
      .from('profiles')
      .select('id, full_name')
      .eq('location_id', locationId)
      .eq('role', 'driver');

    if (error || !drivers || drivers.length === 0) throw new Error('no_drivers');

    const jetzt = new Date();
    const heuteStart = new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate()).toISOString();

    const unsorted: Omit<FahrerQualitaetsScore, 'rang'>[] = await Promise.all(
      drivers.map(async (d: { id: string; full_name: string | null }) => {
        const { data: batches } = await sb
          .from('driver_batches')
          .select('stops_count, on_time_count, driver_rating')
          .eq('driver_id', d.id)
          .eq('location_id', locationId)
          .gte('started_at', heuteStart);

        type B = { stops_count: number | null; on_time_count: number | null; driver_rating: number | null };
        const bList = (batches as B[] | null) ?? [];
        const stopps = bList.reduce((s, b) => s + (b.stops_count ?? 0), 0);
        const pkt = bList.reduce((s, b) => s + (b.on_time_count ?? 0), 0);
        const bewertungen = bList.map((b) => b.driver_rating).filter((r): r is number => r != null);
        const bewAvg = bewertungen.length > 0 ? bewertungen.reduce((s, v) => s + v, 0) / bewertungen.length : 4.0;
        const puenktlichkeit = stopps > 0 ? (pkt / stopps) * 100 : 75;
        const score = scoreBerechnen(puenktlichkeit, bewAvg, stopps);

        const { data: gesternBatches } = await sb
          .from('driver_batches')
          .select('stops_count, on_time_count')
          .eq('driver_id', d.id)
          .eq('location_id', locationId)
          .gte('started_at', new Date(jetzt.getTime() - 86_400_000).toISOString())
          .lt('started_at', heuteStart);

        const gesternStopps = ((gesternBatches as B[] | null) ?? []).reduce((s, b) => s + (b.stops_count ?? 0), 0);
        const gesternPkt = ((gesternBatches as B[] | null) ?? []).reduce((s, b) => s + (b.on_time_count ?? 0), 0);
        const gesternPuenktlichkeit = gesternStopps > 0 ? (gesternPkt / gesternStopps) * 100 : 75;
        const gesternScore = scoreBerechnen(gesternPuenktlichkeit, bewAvg, gesternStopps);
        const delta = score - gesternScore;
        const trend: Trend = delta > 3 ? 'steigend' : delta < -3 ? 'fallend' : 'stabil';

        return {
          fahrer_id: d.id,
          fahrer_name: d.full_name ?? 'Fahrer',
          score,
          puenktlichkeit_pct: Math.round(puenktlichkeit * 10) / 10,
          bewertung_avg: Math.round(bewAvg * 10) / 10,
          stopps_heute: stopps,
          ampel: ampelVon(score),
          trend,
          alert: score < 60,
        };
      }),
    );

    const sorted = [...unsorted].sort((a, b) => b.score - a.score);
    const fahrer: FahrerQualitaetsScore[] = sorted.map((f, i) => ({ ...f, rang: i + 1 }));
    const team_durchschnitt = fahrer.length > 0
      ? Math.round(fahrer.reduce((s, f) => s + f.score, 0) / fahrer.length)
      : 0;

    return NextResponse.json({ location_id: locationId, fahrer, team_durchschnitt, generiert_am: jetzt.toISOString() } satisfies FahrerQualitaetsAntwort);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
