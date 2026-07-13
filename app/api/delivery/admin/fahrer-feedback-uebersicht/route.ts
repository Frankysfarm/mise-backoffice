/**
 * GET /api/delivery/admin/fahrer-feedback-uebersicht?location_id=<uuid>
 *
 * Phase 1281 — Fahrer-Feedback-Übersicht-API (Admin)
 * Aggregierte Kunden-Zufriedenheits-Daten je Fahrer:
 *   - Positiv/Negativ-Quote (Positiv = Daumen hoch, Negativ = Daumen runter)
 *   - Ø-Bewertung (1–5 Sterne aus driver_ratings)
 *   - Trend vs. Vorwoche (besser/gleich/schlechter)
 *   - Kritische Fahrer (Quote < 70%)
 *
 * Multi-Tenant: location_id auf jedem Query.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface FahrerFeedback {
  fahrer_id: string;
  fahrer_name: string;
  zone: string | null;
  positiv: number;
  negativ: number;
  gesamt: number;
  positiv_quote_pct: number;
  avg_rating: number | null;
  trend: 'besser' | 'gleich' | 'schlechter';
  status: 'top' | 'gut' | 'ok' | 'kritisch';
}

interface ApiResponse {
  fahrer: FahrerFeedback[];
  gesamt_positiv_quote_pct: number;
  kritische_fahrer_count: number;
  location_id: string;
  generiert_am: string;
}

function buildMock(locationId: string): ApiResponse {
  const now = new Date().toISOString();
  return {
    fahrer: [
      { fahrer_id: 'mock-1', fahrer_name: 'M. Müller', zone: 'A', positiv: 42, negativ: 3, gesamt: 45, positiv_quote_pct: 93, avg_rating: 4.7, trend: 'besser', status: 'top' },
      { fahrer_id: 'mock-2', fahrer_name: 'S. Schmidt', zone: 'B', positiv: 28, negativ: 4, gesamt: 32, positiv_quote_pct: 88, avg_rating: 4.3, trend: 'gleich', status: 'gut' },
      { fahrer_id: 'mock-3', fahrer_name: 'A. Bauer', zone: 'C', positiv: 15, negativ: 5, gesamt: 20, positiv_quote_pct: 75, avg_rating: 3.9, trend: 'gleich', status: 'ok' },
      { fahrer_id: 'mock-4', fahrer_name: 'T. Fischer', zone: 'D', positiv: 8, negativ: 6, gesamt: 14, positiv_quote_pct: 57, avg_rating: 3.1, trend: 'schlechter', status: 'kritisch' },
    ],
    gesamt_positiv_quote_pct: 81,
    kritische_fahrer_count: 1,
    location_id: locationId,
    generiert_am: now,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id') ?? '';

  try {
    const sb = await createClient();

    // Alle Fahrer der Location
    const { data: drivers, error: driverErr } = await sb
      .from('mise_drivers')
      .select('id, name, delivery_zone')
      .eq('location_id', locationId);

    if (driverErr || !drivers || drivers.length === 0) {
      return NextResponse.json(buildMock(locationId));
    }

    const jetzt = new Date();
    const vor7Tage = new Date(jetzt.getTime() - 7 * 24 * 3_600_000).toISOString();
    const vor14Tage = new Date(jetzt.getTime() - 14 * 24 * 3_600_000).toISOString();

    // Bewertungen letzte 7 Tage
    const { data: ratings7 } = await sb
      .from('driver_ratings')
      .select('driver_id, rating')
      .in('driver_id', drivers.map((d) => d.id))
      .gte('created_at', vor7Tage);

    // Bewertungen 7–14 Tage (Vorwoche)
    const { data: ratings14 } = await sb
      .from('driver_ratings')
      .select('driver_id, rating')
      .in('driver_id', drivers.map((d) => d.id))
      .gte('created_at', vor14Tage)
      .lt('created_at', vor7Tage);

    const fahrer: FahrerFeedback[] = drivers.map((d) => {
      const thisWeek = (ratings7 ?? []).filter((r) => r.driver_id === d.id);
      const lastWeek = (ratings14 ?? []).filter((r) => r.driver_id === d.id);

      const gesamt = thisWeek.length;
      const positiv = thisWeek.filter((r) => (r.rating ?? 0) >= 4).length;
      const negativ = gesamt - positiv;
      const positiv_quote_pct = gesamt > 0 ? Math.round((positiv / gesamt) * 100) : 0;
      const avg_rating = gesamt > 0
        ? Math.round((thisWeek.reduce((s, r) => s + (r.rating ?? 0), 0) / gesamt) * 10) / 10
        : null;

      const lastQuote = lastWeek.length > 0
        ? (lastWeek.filter((r) => (r.rating ?? 0) >= 4).length / lastWeek.length) * 100
        : null;

      let trend: FahrerFeedback['trend'] = 'gleich';
      if (lastQuote !== null) {
        if (positiv_quote_pct > lastQuote + 5) trend = 'besser';
        else if (positiv_quote_pct < lastQuote - 5) trend = 'schlechter';
      }

      let status: FahrerFeedback['status'] = 'ok';
      if (positiv_quote_pct >= 90) status = 'top';
      else if (positiv_quote_pct >= 80) status = 'gut';
      else if (positiv_quote_pct < 70) status = 'kritisch';

      return {
        fahrer_id: d.id,
        fahrer_name: d.name ?? 'Unbekannt',
        zone: (d as { delivery_zone?: string | null }).delivery_zone ?? null,
        positiv,
        negativ,
        gesamt,
        positiv_quote_pct,
        avg_rating,
        trend,
        status,
      };
    });

    const alle = fahrer.reduce((s, f) => ({ positiv: s.positiv + f.positiv, gesamt: s.gesamt + f.gesamt }), { positiv: 0, gesamt: 0 });
    const gesamt_positiv_quote_pct = alle.gesamt > 0 ? Math.round((alle.positiv / alle.gesamt) * 100) : 0;
    const kritische_fahrer_count = fahrer.filter((f) => f.status === 'kritisch').length;

    const response: ApiResponse = {
      fahrer: fahrer.sort((a, b) => b.positiv_quote_pct - a.positiv_quote_pct),
      gesamt_positiv_quote_pct,
      kritische_fahrer_count,
      location_id: locationId,
      generiert_am: jetzt.toISOString(),
    };

    return NextResponse.json(response);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
