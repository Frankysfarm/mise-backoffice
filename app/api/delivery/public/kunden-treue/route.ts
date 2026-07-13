/**
 * GET /api/delivery/public/kunden-treue?location_id=<uuid>&customer_email=<email>
 *
 * Phase 1351 — Kunden-Treue-Score-API (Public)
 * Bestellhäufigkeit + Ø-Bewertung + Stammkunde-Badge (Bronze/Silber/Gold/Platin).
 * Supabase customer_orders + delivery_ratings + Mock-Fallback. Multi-Tenant.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type TreueBadge = 'neu' | 'bronze' | 'silber' | 'gold' | 'platin';

interface TreueResponse {
  gesamt_bestellungen: number;
  badge: TreueBadge;
  badge_label: string;
  naechste_stufe: TreueBadge | null;
  noch_bestellungen_bis_naechste: number | null;
  durchschnittsbewertung: number | null;
  rabattcode: string | null;
  generiert_am: string;
}

const STUFEN: { min: number; badge: TreueBadge; label: string; rabatt: string | null }[] = [
  { min: 10, badge: 'platin', label: 'Platin-Stammgast',  rabatt: 'PLATIN10' },
  { min:  5, badge: 'gold',   label: 'Gold-Stammgast',    rabatt: 'GOLD7' },
  { min:  3, badge: 'silber', label: 'Silber-Stammgast',  rabatt: 'SILBER5' },
  { min:  1, badge: 'bronze', label: 'Bronze-Stammgast',  rabatt: 'BRONZE3' },
  { min:  0, badge: 'neu',    label: 'Neukunde',           rabatt: null },
];

function calcBadge(count: number): { current: (typeof STUFEN)[0]; next: (typeof STUFEN)[0] | null; gap: number | null } {
  const current = STUFEN.find(s => count >= s.min) ?? STUFEN[STUFEN.length - 1];
  const currentIdx = STUFEN.indexOf(current);
  const next = currentIdx > 0 ? STUFEN[currentIdx - 1] : null;
  const gap = next ? next.min - count : null;
  return { current, next, gap };
}

function buildMock(): TreueResponse {
  const count = 4;
  const { current, next, gap } = calcBadge(count);
  return {
    gesamt_bestellungen: count,
    badge: current.badge,
    badge_label: current.label,
    naechste_stufe: next?.badge ?? null,
    noch_bestellungen_bis_naechste: gap,
    durchschnittsbewertung: 4.3,
    rabattcode: current.rabatt,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const locationId     = req.nextUrl.searchParams.get('location_id');
  const customerEmail  = req.nextUrl.searchParams.get('customer_email');

  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }
  if (!customerEmail) {
    return NextResponse.json(buildMock());
  }

  try {
    const sb = await createClient();

    const { data: orders, error: ordersErr } = await (sb as any)
      .from('customer_orders')
      .select('id, status, created_at')
      .eq('location_id', locationId)
      .eq('kunde_email', customerEmail)
      .neq('status', 'cancelled');

    if (ordersErr || !orders) return NextResponse.json(buildMock());

    const count = (orders as { id: string }[]).length;

    const { data: ratings } = await (sb as any)
      .from('delivery_ratings')
      .select('rating')
      .eq('location_id', locationId)
      .eq('customer_email', customerEmail);

    const ratingList = (ratings as { rating: number }[] | null) ?? [];
    const avgRating = ratingList.length > 0
      ? ratingList.reduce((s, r) => s + r.rating, 0) / ratingList.length
      : null;

    const { current, next, gap } = calcBadge(count);

    const response: TreueResponse = {
      gesamt_bestellungen: count,
      badge: current.badge,
      badge_label: current.label,
      naechste_stufe: next?.badge ?? null,
      noch_bestellungen_bis_naechste: gap,
      durchschnittsbewertung: avgRating !== null ? Math.round(avgRating * 10) / 10 : null,
      rabattcode: current.rabatt,
      generiert_am: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch {
    return NextResponse.json(buildMock());
  }
}
