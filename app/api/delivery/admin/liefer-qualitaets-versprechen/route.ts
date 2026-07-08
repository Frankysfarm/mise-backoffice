/**
 * GET /api/delivery/admin/liefer-qualitaets-versprechen?location_id=<uuid>
 *
 * Phase 683 (Backend) — Liefer-Qualitäts-Versprechen-API
 * Ø Bewertung + Pünktlichkeitsquote (letzte 30 Tage) + aktueller Küchenstatus.
 *
 * Response: { ok, rating, punctualityPct, kueche, generatedAt }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  if (!locationId) {
    return NextResponse.json({ ok: false, error: 'location_id required' }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    const since = new Date();
    since.setDate(since.getDate() - 30);
    const sinceIso = since.toISOString();

    // Bewertungen + Pünktlichkeitsdaten aus gelieferten Bestellungen
    const { data: orders } = await supabase
      .from('orders')
      .select('rating, created_at, delivered_at, estimated_delivery_at')
      .eq('location_id', locationId)
      .eq('status', 'delivered')
      .gte('created_at', sinceIso);

    const delivered = orders ?? [];
    const ratings = delivered
      .map((o) => o.rating as number | null)
      .filter((r): r is number => typeof r === 'number' && r >= 1 && r <= 5);
    const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;

    // Pünktlichkeit: geliefert <= estimated_delivery_at
    const withEta = delivered.filter(
      (o) => o.delivered_at && o.estimated_delivery_at,
    );
    const puenktlich = withEta.filter(
      (o) =>
        new Date(o.delivered_at as string).getTime() <=
        new Date(o.estimated_delivery_at as string).getTime() + 5 * 60_000, // +5 Min Toleranz
    );
    const punctualityPct =
      withEta.length > 0 ? Math.round((puenktlich.length / withEta.length) * 100) : null;

    // Aktueller Küchenstatus (live)
    const { data: liveOrders } = await supabase
      .from('orders')
      .select('status')
      .eq('location_id', locationId)
      .in('status', ['bestätigt', 'in_zubereitung', 'fertig']);

    const offene = (liveOrders ?? []).filter((o) =>
      ['bestätigt', 'in_zubereitung'].includes(o.status as string),
    ).length;
    const kueche: 'frei' | 'knapp' | 'ausgelastet' =
      offene <= 4 ? 'frei' : offene <= 9 ? 'knapp' : 'ausgelastet';

    return NextResponse.json({
      ok: true,
      rating: avgRating !== null ? Math.round(avgRating * 10) / 10 : null,
      ratingAnzahl: ratings.length,
      punctualityPct,
      puenktlichAnzahl: puenktlich.length,
      gesamtLieferungen: delivered.length,
      kueche,
      offeneBestellungen: offene,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('liefer-qualitaets-versprechen error:', err);
    return NextResponse.json({ ok: false, error: 'server error' }, { status: 500 });
  }
}
