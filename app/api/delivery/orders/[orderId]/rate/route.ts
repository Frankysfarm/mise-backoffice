/**
 * GET  /api/delivery/orders/[orderId]/rating-token
 *   → Generiert oder gibt bestehenden Rating-Token zurück (Admin/Server-intern)
 *
 * POST /api/delivery/orders/[orderId]/rate
 *   { token, rating (1–5), comment? }
 *   → Kunden-Bewertung einreichen (öffentlich, token-geschützt)
 *
 * Hinweis: Der öffentliche Rating-Endpoint /rate/[token] ist in der Storefront implementiert.
 * Dieser Endpoint wird vom Server nach Lieferung und von Admin-Tools genutzt.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { generateRatingToken, submitCustomerRating } from '@/lib/delivery/satisfaction';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST: Kunden-Bewertung einreichen (öffentlich via Token) */
export async function POST(
  req: NextRequest,
  { params }: { params: { orderId: string } },
) {
  const body = await req.json() as {
    token?: string;
    rating?: number;
    comment?: string;
  };

  if (!body.token) {
    return NextResponse.json({ error: 'token erforderlich' }, { status: 400 });
  }

  const rating = Number(body.rating);
  if (!rating || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
    return NextResponse.json({ error: 'rating muss 1–5 sein' }, { status: 400 });
  }

  const result = await submitCustomerRating({
    token:   body.token,
    rating:  rating as 1 | 2 | 3 | 4 | 5,
    comment: body.comment,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  if (result.alreadyRated) {
    return NextResponse.json({ ok: true, alreadyRated: true });
  }

  return NextResponse.json({ ok: true });
}

/** GET: Rating-Token für eine Bestellung generieren (interner Admin-Aufruf) */
export async function GET(
  _req: NextRequest,
  { params }: { params: { orderId: string } },
) {
  const sb = createServiceClient();

  // Sicherheitscheck: Order muss geliefert sein
  const { data: order } = await sb
    .from('customer_orders')
    .select('id, status')
    .eq('id', params.orderId)
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ error: 'Bestellung nicht gefunden' }, { status: 404 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const result = await generateRatingToken(params.orderId, baseUrl);

  if (!result) {
    return NextResponse.json({ error: 'Token-Generierung fehlgeschlagen' }, { status: 500 });
  }

  return NextResponse.json(result);
}
