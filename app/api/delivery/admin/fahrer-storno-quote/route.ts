/**
 * GET /api/delivery/admin/fahrer-storno-quote?location_id=<uuid>[&driver_id=<uuid>]
 *
 * Phase 2440 — Fahrer-Storno-Quote-API
 * Storno-Quote je Fahrer heute (Stornierungen / Gesamt-Touren × 100%).
 * Ampel grün(<5%)/gelb(5–10%)/rot(>10%); Alert >10%; Trend vs. Vorwoche; Multi-Tenant; Supabase+Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type Ampel = 'gruen' | 'gelb' | 'rot';
export type Trend = 'steigend' | 'fallend' | 'stabil';

export interface FahrerStornoQuote {
  fahrer_id: string;
  fahrer_name: string;
  quote_pct: number;
  gesamt_touren: number;
  stornierungen: number;
  ampel: Ampel;
  trend: Trend;
  trend_delta: number;
  vw_quote_pct: number;
  rang: number;
}

export interface StornoQuoteAntwort {
  location_id: string;
  fahrer: FahrerStornoQuote[];
  team_durchschnitt: number;
  alert_count: number;
  generiert_am: string;
}

function ampelVon(pct: number): Ampel {
  if (pct < 5) return 'gruen';
  if (pct <= 10) return 'gelb';
  return 'rot';
}

function trendVon(heute: number, vorwoche: number): { trend: Trend; delta: number } {
  const delta = Math.round((heute - vorwoche) * 10) / 10;
  if (delta > 1) return { trend: 'steigend', delta };
  if (delta < -1) return { trend: 'fallend', delta };
  return { trend: 'stabil', delta };
}

const MOCK_FAHRER = [
  { fahrer_id: 'mock-f1', fahrer_name: 'Max Müller', gesamt: 14, storniert: 0, vw_pct: 1.5 },
  { fahrer_id: 'mock-f2', fahrer_name: 'Sara Koch', gesamt: 11, storniert: 1, vw_pct: 3.0 },
  { fahrer_id: 'mock-f3', fahrer_name: 'Tim Weber', gesamt: 9, storniert: 1, vw_pct: 8.0 },
  { fahrer_id: 'mock-f4', fahrer_name: 'Anna Bauer', gesamt: 12, storniert: 2, vw_pct: 12.5 },
];

function buildMock(locationId: string): StornoQuoteAntwort {
  const unsorted = MOCK_FAHRER.map(f => {
    const quote_pct = f.gesamt > 0 ? Math.round((f.storniert / f.gesamt) * 1000) / 10 : 0;
    const { trend, delta } = trendVon(quote_pct, f.vw_pct);
    return {
      fahrer_id: f.fahrer_id,
      fahrer_name: f.fahrer_name,
      quote_pct,
      gesamt_touren: f.gesamt,
      stornierungen: f.storniert,
      ampel: ampelVon(quote_pct),
      trend,
      trend_delta: delta,
      vw_quote_pct: f.vw_pct,
    };
  });
  const sorted = [...unsorted].sort((a, b) => a.quote_pct - b.quote_pct);
  const fahrer: FahrerStornoQuote[] = sorted.map((f, i) => ({ ...f, rang: i + 1 }));
  const team_durchschnitt =
    Math.round((fahrer.reduce((s, f) => s + f.quote_pct, 0) / fahrer.length) * 10) / 10;
  return {
    location_id: locationId,
    fahrer,
    team_durchschnitt,
    alert_count: fahrer.filter(f => f.quote_pct > 10).length,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const locationId = searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const sb = await createClient();
    const jetzt = new Date();
    const heuteStart = new Date(jetzt);
    heuteStart.setHours(0, 0, 0, 0);
    const vwStart = new Date(heuteStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    const vwEnd = new Date(heuteStart.getTime() - 6 * 24 * 60 * 60 * 1000);

    const { data: drivers, error: dErr } = await sb
      .from('drivers')
      .select('id, full_name')
      .eq('location_id', locationId)
      .eq('is_active', true);

    if (dErr || !drivers || drivers.length === 0) return NextResponse.json(buildMock(locationId));

    type Driver = { id: string; full_name: string | null };

    const unsorted = await Promise.all(
      (drivers as Driver[]).map(async (d) => {
        const { data: toursHeute } = await sb
          .from('delivery_tours')
          .select('status')
          .eq('driver_id', d.id)
          .eq('location_id', locationId)
          .gte('created_at', heuteStart.toISOString());

        type TourRow = { status: string | null };
        const rowsHeute = (toursHeute as TourRow[] | null) ?? [];
        const gesamt_heute = rowsHeute.length;
        const storniert_heute = rowsHeute.filter(
          t => t.status === 'cancelled' || t.status === 'storniert'
        ).length;
        const quote_pct_heute =
          gesamt_heute > 0 ? Math.round((storniert_heute / gesamt_heute) * 1000) / 10 : 0;

        const { data: toursVW } = await sb
          .from('delivery_tours')
          .select('status')
          .eq('driver_id', d.id)
          .eq('location_id', locationId)
          .gte('created_at', vwStart.toISOString())
          .lt('created_at', vwEnd.toISOString());

        const rowsVW = (toursVW as TourRow[] | null) ?? [];
        const gesamt_vw = rowsVW.length;
        const storniert_vw = rowsVW.filter(
          t => t.status === 'cancelled' || t.status === 'storniert'
        ).length;
        const quote_pct_vw =
          gesamt_vw > 0 ? Math.round((storniert_vw / gesamt_vw) * 1000) / 10 : quote_pct_heute;

        const { trend, delta } = trendVon(quote_pct_heute, quote_pct_vw);

        return {
          fahrer_id: d.id,
          fahrer_name: d.full_name ?? 'Fahrer',
          quote_pct: quote_pct_heute,
          gesamt_touren: gesamt_heute,
          stornierungen: storniert_heute,
          ampel: ampelVon(quote_pct_heute),
          trend,
          trend_delta: delta,
          vw_quote_pct: quote_pct_vw,
        };
      })
    );

    const sorted = [...unsorted].sort((a, b) => a.quote_pct - b.quote_pct);
    const fahrer: FahrerStornoQuote[] = sorted.map((f, i) => ({ ...f, rang: i + 1 }));
    const team_durchschnitt =
      fahrer.length > 0
        ? Math.round((fahrer.reduce((s, f) => s + f.quote_pct, 0) / fahrer.length) * 10) / 10
        : 0;

    return NextResponse.json({
      location_id: locationId,
      fahrer,
      team_durchschnitt,
      alert_count: fahrer.filter(f => f.quote_pct > 10).length,
      generiert_am: jetzt.toISOString(),
    } satisfies StornoQuoteAntwort);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
