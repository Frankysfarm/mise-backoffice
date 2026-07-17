/**
 * Phase 2143 — Fahrer-Feedback-Score-API
 *
 * GET /api/delivery/admin/fahrer-feedback-score?location_id=<uuid>
 * Ø Bewertung je Fahrer (1–5 Sterne) heute; Anzahl Bewertungen; Trend vs. 7-Tage-Ø; Alert wenn <3.5
 * Multi-Tenant; Supabase + Mock-Fallback.
 *
 * Response: { location_id, fahrer: FahrerFeedback[], team_durchschnitt, generiert_am }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type Trend = 'steigend' | 'fallend' | 'stabil';

export interface FahrerFeedback {
  fahrer_id: string;
  name: string;
  avg_sterne: number;
  anzahl_bewertungen: number;
  trend: Trend;
  trend_delta: number;
  alert: boolean;
  rang: number;
}

export interface FahrerFeedbackScoreAntwort {
  location_id: string;
  fahrer: FahrerFeedback[];
  team_durchschnitt: number;
  generiert_am: string;
}

const MOCK_FAHRER = [
  { fahrer_id: 'f1', name: 'Max Müller',    avg_sterne: 4.8, anzahl_bewertungen: 12, trend: 'steigend' as Trend, trend_delta: 0.3, alert: false },
  { fahrer_id: 'f2', name: 'Lena Schmidt',  avg_sterne: 4.2, anzahl_bewertungen: 8,  trend: 'stabil'   as Trend, trend_delta: 0.0, alert: false },
  { fahrer_id: 'f3', name: 'Tom Becker',    avg_sterne: 3.1, anzahl_bewertungen: 5,  trend: 'fallend'  as Trend, trend_delta: -0.6, alert: true },
];

function trendVon(heute: number, avg7Tage: number): { trend: Trend; delta: number } {
  const delta = Math.round((heute - avg7Tage) * 10) / 10;
  if (delta > 0.2) return { trend: 'steigend', delta };
  if (delta < -0.2) return { trend: 'fallend', delta };
  return { trend: 'stabil', delta: 0 };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const jetzt = new Date();
  const heuteStart = new Date(jetzt);
  heuteStart.setHours(0, 0, 0, 0);
  const vor7Tagen = new Date(jetzt.getTime() - 7 * 24 * 60 * 60 * 1000);

  try {
    const supabase = await createClient();

    const { data: drivers } = await supabase
      .from('drivers')
      .select('id, full_name')
      .eq('location_id', locationId)
      .eq('is_active', true);

    if (!drivers || drivers.length === 0) throw new Error('keine Fahrer');

    const unsorted = await Promise.all(
      drivers.map(async (d: { id: string; full_name: string | null }) => {
        const { data: heuteRows } = await supabase
          .from('delivery_feedback')
          .select('rating')
          .eq('driver_id', d.id)
          .gte('created_at', heuteStart.toISOString());

        const anzahlHeute = heuteRows?.length ?? 0;
        const avgHeute =
          anzahlHeute > 0
            ? Math.round(((heuteRows ?? []).reduce((s: number, r: { rating: number }) => s + r.rating, 0) / anzahlHeute) * 10) / 10
            : 0;

        const { data: wocheRows } = await supabase
          .from('delivery_feedback')
          .select('rating')
          .eq('driver_id', d.id)
          .gte('created_at', vor7Tagen.toISOString());

        const avg7 =
          (wocheRows?.length ?? 0) > 0
            ? Math.round(((wocheRows ?? []).reduce((s: number, r: { rating: number }) => s + r.rating, 0) / (wocheRows?.length ?? 1)) * 10) / 10
            : avgHeute;

        const { trend, delta } = trendVon(avgHeute, avg7);

        return {
          fahrer_id: d.id,
          name: d.full_name ?? 'Unbekannt',
          avg_sterne: avgHeute,
          anzahl_bewertungen: anzahlHeute,
          trend,
          trend_delta: delta,
          alert: avgHeute > 0 && avgHeute < 3.5,
        };
      })
    );

    const sorted = [...unsorted].sort((a, b) => b.avg_sterne - a.avg_sterne);
    const fahrerListe: FahrerFeedback[] = sorted.map((f, i) => ({ ...f, rang: i + 1 }));

    const mitBewertung = fahrerListe.filter(f => f.anzahl_bewertungen > 0);
    const team_durchschnitt =
      mitBewertung.length > 0
        ? Math.round((mitBewertung.reduce((s, f) => s + f.avg_sterne, 0) / mitBewertung.length) * 10) / 10
        : 0;

    return NextResponse.json({
      location_id: locationId,
      fahrer: fahrerListe,
      team_durchschnitt,
      generiert_am: jetzt.toISOString(),
    } satisfies FahrerFeedbackScoreAntwort);
  } catch {
    const sorted = [...MOCK_FAHRER].sort((a, b) => b.avg_sterne - a.avg_sterne);
    const fahrerListe: FahrerFeedback[] = sorted.map((f, i) => ({ ...f, rang: i + 1 }));
    return NextResponse.json({
      location_id: locationId,
      fahrer: fahrerListe,
      team_durchschnitt:
        Math.round((fahrerListe.reduce((s, f) => s + f.avg_sterne, 0) / fahrerListe.length) * 10) / 10,
      generiert_am: new Date().toISOString(),
    } satisfies FahrerFeedbackScoreAntwort);
  }
}
