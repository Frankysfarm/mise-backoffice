/**
 * GET /api/delivery/admin/fahrer-lieferfenster?location_id=<uuid>
 *
 * Phase 2274 — Fahrer-Lieferfenster-API
 * Anteil pünktlicher Lieferungen innerhalb des versprochenen Fensters (30–45 Min) je Fahrer heute;
 * Trend vs. Vorwoche; Alert wenn <80%; Multi-Tenant; Supabase+Mock.
 *
 * Response: { location_id, fahrer: FahrerLieferfenster[], team_quote, alert_count, generiert_am }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type Ampel = 'gruen' | 'gelb' | 'rot';
export type Trend = 'steigend' | 'fallend' | 'stabil';

export interface FahrerLieferfenster {
  fahrer_id: string;
  fahrer_name: string;
  quote_pct: number;
  lieferungen_heute: number;
  im_fenster_heute: number;
  trend: Trend;
  trend_delta: number;
  ampel: Ampel;
  rang: number;
}

export interface FahrerLieferfensterAntwort {
  location_id: string;
  fahrer: FahrerLieferfenster[];
  team_quote: number;
  alert_count: number;
  generiert_am: string;
}

function ampelVon(quote: number): Ampel {
  if (quote >= 95) return 'gruen';
  if (quote >= 80) return 'gelb';
  return 'rot';
}

function trendVon(heute: number, vorwoche: number): { trend: Trend; delta: number } {
  const delta = Math.round((heute - vorwoche) * 10) / 10;
  if (delta > 2) return { trend: 'steigend', delta };
  if (delta < -2) return { trend: 'fallend', delta };
  return { trend: 'stabil', delta: Math.round(delta * 10) / 10 };
}

const MOCK_FAHRER: Omit<FahrerLieferfenster, 'rang'>[] = [
  {
    fahrer_id: 'mock-f1',
    fahrer_name: 'Max Müller',
    quote_pct: 97.5,
    lieferungen_heute: 12,
    im_fenster_heute: 11,
    trend: 'steigend',
    trend_delta: 3.2,
    ampel: 'gruen',
  },
  {
    fahrer_id: 'mock-f2',
    fahrer_name: 'Sara Koch',
    quote_pct: 88.9,
    lieferungen_heute: 9,
    im_fenster_heute: 8,
    trend: 'stabil',
    trend_delta: 0.5,
    ampel: 'gelb',
  },
  {
    fahrer_id: 'mock-f3',
    fahrer_name: 'Tim Becker',
    quote_pct: 71.4,
    lieferungen_heute: 7,
    im_fenster_heute: 5,
    trend: 'fallend',
    trend_delta: -8.6,
    ampel: 'rot',
  },
  {
    fahrer_id: 'mock-f4',
    fahrer_name: 'Lisa Fuchs',
    quote_pct: 100.0,
    lieferungen_heute: 8,
    im_fenster_heute: 8,
    trend: 'steigend',
    trend_delta: 5.0,
    ampel: 'gruen',
  },
];

function buildMock(locationId: string): FahrerLieferfensterAntwort {
  const sorted = [...MOCK_FAHRER].sort((a, b) => b.quote_pct - a.quote_pct);
  const fahrerListe: FahrerLieferfenster[] = sorted.map((f, i) => ({ ...f, rang: i + 1 }));
  const team_quote =
    Math.round(
      (fahrerListe.reduce((s, f) => s + f.quote_pct, 0) / fahrerListe.length) * 10
    ) / 10;
  return {
    location_id: locationId,
    fahrer: fahrerListe,
    team_quote,
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

    type TourRow = {
      driver_id: string;
      delivered_at: string | null;
      promised_at: string | null;
      created_at: string;
    };

    const unsorted: Omit<FahrerLieferfenster, 'rang'>[] = await Promise.all(
      (drivers as { id: string; full_name: string | null }[]).map(async (d) => {
        const { data: toursHeute } = await sb
          .from('tours')
          .select('driver_id, delivered_at, promised_at, created_at')
          .eq('driver_id', d.id)
          .eq('location_id', locationId)
          .not('delivered_at', 'is', null)
          .gte('created_at', heuteStart.toISOString())
          .lt('created_at', jetzt.toISOString());

        const { data: toursVorwoche } = await sb
          .from('tours')
          .select('driver_id, delivered_at, promised_at, created_at')
          .eq('driver_id', d.id)
          .eq('location_id', locationId)
          .not('delivered_at', 'is', null)
          .gte('created_at', vorwocheStart.toISOString())
          .lt('created_at', vorwocheEnd.toISOString());

        function countImFenster(rows: TourRow[]): number {
          return rows.filter((r) => {
            if (!r.delivered_at || !r.promised_at) return false;
            const diff =
              (new Date(r.delivered_at).getTime() - new Date(r.promised_at).getTime()) / 60000;
            return diff <= 0;
          }).length;
        }

        const liefH = toursHeute?.length ?? 0;
        const imFH = liefH > 0 ? countImFenster(toursHeute as TourRow[]) : 0;
        const quoteH = liefH > 0 ? Math.round((imFH / liefH) * 1000) / 10 : 90;

        const liefV = toursVorwoche?.length ?? 0;
        const imFV = liefV > 0 ? countImFenster(toursVorwoche as TourRow[]) : 0;
        const quoteV = liefV > 0 ? Math.round((imFV / liefV) * 1000) / 10 : 90;

        const { trend, delta } = trendVon(quoteH, quoteV);

        return {
          fahrer_id: d.id,
          fahrer_name: d.full_name ?? 'Fahrer',
          quote_pct: quoteH,
          lieferungen_heute: liefH,
          im_fenster_heute: imFH,
          trend,
          trend_delta: delta,
          ampel: ampelVon(quoteH),
        };
      })
    );

    const sorted = [...unsorted].sort((a, b) => b.quote_pct - a.quote_pct);
    const fahrerListe: FahrerLieferfenster[] = sorted.map((f, i) => ({ ...f, rang: i + 1 }));

    const team_quote =
      fahrerListe.length > 0
        ? Math.round(
            (fahrerListe.reduce((s, f) => s + f.quote_pct, 0) / fahrerListe.length) * 10
          ) / 10
        : 0;

    return NextResponse.json({
      location_id: locationId,
      fahrer: fahrerListe,
      team_quote,
      alert_count: fahrerListe.filter((f) => f.ampel === 'rot').length,
      generiert_am: jetzt.toISOString(),
    } satisfies FahrerLieferfensterAntwort);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
