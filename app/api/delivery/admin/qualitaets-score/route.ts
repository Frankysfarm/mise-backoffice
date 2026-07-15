/**
 * GET /api/delivery/admin/qualitaets-score?location_id=<uuid>
 *
 * Phase 1686 — Qualitäts-Score-API
 * Ø Bewertung letzter 7 Tage + Liefer-Pünktlichkeits-%.
 * Multi-Tenant: location_id je Query. Supabase + Mock-Fallback.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface QualitaetsScoreResponse {
  location_id: string;
  avg_bewertung: number;
  anzahl_bewertungen: number;
  puenktlichkeit_pct: number;
  lieferungen_7d: number;
  generiert_am: string;
}

function buildMock(locationId: string): QualitaetsScoreResponse {
  const seed = locationId.charCodeAt(0) || 65;
  const rng = (base: number, range: number, s: number) =>
    base + (((seed * s) % range) - range / 2) / 10;

  return {
    location_id: locationId,
    avg_bewertung: Math.min(5, Math.max(1, Math.round(rng(4.6, 8, 3) * 10) / 10)),
    anzahl_bewertungen: Math.round(100 + ((seed * 7) % 150)),
    puenktlichkeit_pct: Math.min(100, Math.round(85 + ((seed * 11) % 15))),
    lieferungen_7d: Math.round(200 + ((seed * 5) % 300)),
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id') ?? 'all';

  try {
    const sb = await createClient();
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Bewertungen letzte 7 Tage
    let ratingQ = (sb as any)
      .from('order_ratings')
      .select('rating')
      .gte('created_at', sevenDaysAgo);
    if (locationId !== 'all') ratingQ = ratingQ.eq('location_id', locationId);
    const { data: ratings, error: rErr } = await ratingQ;

    // Lieferungen + Pünktlichkeit (delivered_at vs promised_at)
    let orderQ = (sb as any)
      .from('orders')
      .select('delivered_at, promised_at, eta_min, created_at')
      .eq('status', 'delivered')
      .gte('created_at', sevenDaysAgo);
    if (locationId !== 'all') orderQ = orderQ.eq('location_id', locationId);
    const { data: orders, error: oErr } = await orderQ;

    if (rErr && oErr) {
      return NextResponse.json(buildMock(locationId));
    }

    // Ø Bewertung
    const ratingList = (ratings ?? []) as { rating: number }[];
    const avg_bewertung =
      ratingList.length > 0
        ? Math.round((ratingList.reduce((s, r) => s + r.rating, 0) / ratingList.length) * 10) / 10
        : buildMock(locationId).avg_bewertung;

    // Pünktlichkeit
    const orderList = (orders ?? []) as {
      delivered_at?: string | null;
      promised_at?: string | null;
      eta_min?: number | null;
      created_at?: string | null;
    }[];

    let puenktlich = 0;
    for (const o of orderList) {
      if (!o.delivered_at) continue;
      const deliveredMs = new Date(o.delivered_at).getTime();
      let deadlineMs: number | null = null;
      if (o.promised_at) {
        deadlineMs = new Date(o.promised_at).getTime();
      } else if (o.created_at && o.eta_min) {
        deadlineMs = new Date(o.created_at).getTime() + o.eta_min * 60000;
      }
      if (deadlineMs !== null && deliveredMs <= deadlineMs + 5 * 60000) puenktlich++;
    }

    const lieferungen_7d = orderList.length;
    const puenktlichkeit_pct =
      lieferungen_7d > 0
        ? Math.round((puenktlich / lieferungen_7d) * 100)
        : buildMock(locationId).puenktlichkeit_pct;

    return NextResponse.json({
      location_id: locationId,
      avg_bewertung: ratingList.length > 0 ? avg_bewertung : buildMock(locationId).avg_bewertung,
      anzahl_bewertungen: ratingList.length,
      puenktlichkeit_pct,
      lieferungen_7d,
      generiert_am: now.toISOString(),
    } satisfies QualitaetsScoreResponse);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
