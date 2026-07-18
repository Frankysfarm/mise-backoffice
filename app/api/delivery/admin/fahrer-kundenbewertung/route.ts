/**
 * GET /api/delivery/admin/fahrer-kundenbewertung?location_id=<uuid>
 *
 * Phase 2254 — Fahrer-Kundenbewertungs-API
 * Ø Kundenbewertung (1–5 Sterne) je Fahrer heute; Trend vs. Vorwoche; Alert wenn <4.0; Multi-Tenant; Supabase+Mock.
 *
 * Response: { location_id, fahrer: FahrerKundenbewertung[], team_durchschnitt, alert_count, generiert_am }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type Ampel = 'gruen' | 'gelb' | 'rot';
export type Trend = 'steigend' | 'fallend' | 'stabil';

export interface FahrerKundenbewertung {
  fahrer_id: string;
  fahrer_name: string;
  bewertung_avg: number;
  bewertungen_heute: number;
  trend: Trend;
  trend_delta: number;
  ampel: Ampel;
  rang: number;
}

export interface FahrerKundenbewertungAntwort {
  location_id: string;
  fahrer: FahrerKundenbewertung[];
  team_durchschnitt: number;
  alert_count: number;
  generiert_am: string;
}

function ampelVon(avg: number): Ampel {
  if (avg >= 4.5) return 'gruen';
  if (avg >= 4.0) return 'gelb';
  return 'rot';
}

function trendVon(heute: number, vorwoche: number): { trend: Trend; delta: number } {
  const delta = Math.round((heute - vorwoche) * 10) / 10;
  if (delta > 0.2) return { trend: 'steigend', delta };
  if (delta < -0.2) return { trend: 'fallend', delta };
  return { trend: 'stabil', delta };
}

const MOCK_FAHRER: Omit<FahrerKundenbewertung, 'rang'>[] = [
  {
    fahrer_id: 'mock-f1',
    fahrer_name: 'Max Müller',
    bewertung_avg: 4.8,
    bewertungen_heute: 12,
    trend: 'steigend',
    trend_delta: 0.3,
    ampel: 'gruen',
  },
  {
    fahrer_id: 'mock-f2',
    fahrer_name: 'Sara Koch',
    bewertung_avg: 4.2,
    bewertungen_heute: 9,
    trend: 'stabil',
    trend_delta: 0.0,
    ampel: 'gelb',
  },
  {
    fahrer_id: 'mock-f3',
    fahrer_name: 'Tim Becker',
    bewertung_avg: 3.8,
    bewertungen_heute: 7,
    trend: 'fallend',
    trend_delta: -0.4,
    ampel: 'rot',
  },
  {
    fahrer_id: 'mock-f4',
    fahrer_name: 'Lisa Fuchs',
    bewertung_avg: 4.6,
    bewertungen_heute: 11,
    trend: 'steigend',
    trend_delta: 0.2,
    ampel: 'gruen',
  },
];

function buildMock(locationId: string): FahrerKundenbewertungAntwort {
  const sorted = [...MOCK_FAHRER].sort((a, b) => b.bewertung_avg - a.bewertung_avg);
  const fahrerListe: FahrerKundenbewertung[] = sorted.map((f, i) => ({ ...f, rang: i + 1 }));
  const team_durchschnitt =
    Math.round((fahrerListe.reduce((s, f) => s + f.bewertung_avg, 0) / fahrerListe.length) * 10) / 10;
  return {
    location_id: locationId,
    fahrer: fahrerListe,
    team_durchschnitt,
    alert_count: fahrerListe.filter((f) => f.ampel === 'rot').length,
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
    const heuteStart = new Date(jetzt);
    heuteStart.setHours(0, 0, 0, 0);
    const vorwocheStart = new Date(heuteStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    const vorwocheEnd = new Date(heuteStart.getTime() - 6 * 24 * 60 * 60 * 1000);

    type ReviewRow = { rating: number | null; driver_id: string };

    const unsorted: Omit<FahrerKundenbewertung, 'rang'>[] = await Promise.all(
      (drivers as { id: string; full_name: string | null }[]).map(async (d) => {
        const { data: reviewsHeute } = await sb
          .from('order_ratings')
          .select('rating, driver_id')
          .eq('driver_id', d.id)
          .eq('location_id', locationId)
          .gte('created_at', heuteStart.toISOString())
          .lt('created_at', jetzt.toISOString());

        const { data: reviewsVorwoche } = await sb
          .from('order_ratings')
          .select('rating, driver_id')
          .eq('driver_id', d.id)
          .eq('location_id', locationId)
          .gte('created_at', vorwocheStart.toISOString())
          .lt('created_at', vorwocheEnd.toISOString());

        const avgHeute =
          reviewsHeute && reviewsHeute.length > 0
            ? Math.round(
                ((reviewsHeute as ReviewRow[]).reduce((s, r) => s + (r.rating ?? 0), 0) /
                  reviewsHeute.length) *
                  10
              ) / 10
            : 4.0;

        const avgVorwoche =
          reviewsVorwoche && reviewsVorwoche.length > 0
            ? Math.round(
                ((reviewsVorwoche as ReviewRow[]).reduce((s, r) => s + (r.rating ?? 0), 0) /
                  reviewsVorwoche.length) *
                  10
              ) / 10
            : 4.0;

        const { trend, delta } = trendVon(avgHeute, avgVorwoche);

        return {
          fahrer_id: d.id,
          fahrer_name: d.full_name ?? 'Fahrer',
          bewertung_avg: avgHeute,
          bewertungen_heute: reviewsHeute?.length ?? 0,
          trend,
          trend_delta: delta,
          ampel: ampelVon(avgHeute),
        };
      })
    );

    const sorted = [...unsorted].sort((a, b) => b.bewertung_avg - a.bewertung_avg);
    const fahrerListe: FahrerKundenbewertung[] = sorted.map((f, i) => ({ ...f, rang: i + 1 }));

    const team_durchschnitt =
      fahrerListe.length > 0
        ? Math.round(
            (fahrerListe.reduce((s, f) => s + f.bewertung_avg, 0) / fahrerListe.length) * 10
          ) / 10
        : 0;

    return NextResponse.json({
      location_id: locationId,
      fahrer: fahrerListe,
      team_durchschnitt,
      alert_count: fahrerListe.filter((f) => f.ampel === 'rot').length,
      generiert_am: jetzt.toISOString(),
    } satisfies FahrerKundenbewertungAntwort);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
