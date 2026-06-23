/**
 * POST /api/delivery/customer/rating
 *
 * Kunden-Bewertung nach Lieferung.
 * Schreibt in customer_delivery_ratings (Unique: order_id).
 *
 * Body: { order_id, driver_id?, stars, comment?, source?, location_id? }
 * Auth: optional (public endpoint, via rating_token falls vorhanden)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RatingBody {
  order_id: string;
  driver_id?: string | null;
  stars: number;
  comment?: string | null;
  source?: string | null;
  location_id?: string | null;
  rating_token?: string | null;
}

export async function POST(req: NextRequest) {
  let body: RatingBody;
  try {
    body = (await req.json()) as RatingBody;
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request-Body' }, { status: 400 });
  }

  const { order_id, driver_id, stars, comment, rating_token, location_id } = body;

  if (!order_id) return NextResponse.json({ error: 'order_id fehlt' }, { status: 400 });
  if (typeof stars !== 'number' || stars < 1 || stars > 5) {
    return NextResponse.json({ error: 'stars muss 1–5 sein' }, { status: 400 });
  }

  const sb = createServiceClient();

  // Look up order to validate and get location_id if not provided
  const { data: order, error: orderErr } = await sb
    .from('customer_orders')
    .select('id, location_id, rating_token')
    .eq('id', order_id)
    .single();

  if (orderErr || !order) {
    return NextResponse.json({ error: 'Bestellung nicht gefunden' }, { status: 404 });
  }

  // Token validation: if the order has a rating_token, it must match
  const orderToken = order.rating_token as string | null;
  if (orderToken && rating_token !== orderToken) {
    return NextResponse.json({ error: 'Ungültiger Bewertungs-Token' }, { status: 403 });
  }

  const resolvedLocationId = (location_id ?? (order.location_id as string | null));
  if (!resolvedLocationId) {
    return NextResponse.json({ error: 'location_id nicht ermittelbar' }, { status: 400 });
  }

  // Upsert: one rating per order (idx_cdr_order_unique)
  const { data: rating, error: ratingErr } = await sb
    .from('customer_delivery_ratings')
    .upsert(
      {
        order_id,
        driver_id: driver_id ?? null,
        location_id: resolvedLocationId,
        rating: stars,
        comment: comment ?? null,
        rating_token: rating_token ?? null,
        token_used_at: rating_token ? new Date().toISOString() : null,
      },
      { onConflict: 'order_id' },
    )
    .select('id, rating, created_at')
    .single();

  if (ratingErr) {
    return NextResponse.json({ error: ratingErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, rating });
}

export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams;
  const orderId = params.get('order_id');
  if (!orderId) return NextResponse.json({ error: 'order_id fehlt' }, { status: 400 });

  const sb = createServiceClient();
  const { data } = await sb
    .from('customer_delivery_ratings')
    .select('id, rating, comment, created_at')
    .eq('order_id', orderId)
    .maybeSingle();

  return NextResponse.json({ rating: data ?? null });
}
