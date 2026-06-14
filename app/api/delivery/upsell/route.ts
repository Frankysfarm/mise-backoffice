/**
 * POST /api/delivery/upsell
 * Public endpoint — called from Storefront checkout to get suggestions.
 *
 * Body: { location_id, cart_items: string[], order_id? }
 * Returns: { suggestions: UpsellSuggestion[], impression_ids: string[] }
 *
 * POST /api/delivery/upsell  (action=convert)
 * Body: { impression_id, revenue_eur }
 * Records that the customer added the suggested item.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  getUpsellSuggestions,
  recordImpression,
  recordConversion,
} from '@/lib/delivery/smart-upsell';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json() as Record<string, unknown>;
  const action = (body.action as string | undefined) ?? 'suggest';

  if (action === 'convert') {
    const impressionId = String(body.impression_id ?? '');
    const revenueEur   = Number(body.revenue_eur ?? 0);
    if (!impressionId) return NextResponse.json({ error: 'impression_id fehlt' }, { status: 400 });
    await recordConversion(impressionId, revenueEur);
    return NextResponse.json({ ok: true });
  }

  // action=suggest (default)
  const locationId = String(body.location_id ?? '');
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const cartItems = Array.isArray(body.cart_items)
    ? (body.cart_items as unknown[]).filter(i => typeof i === 'string').map(i => String(i))
    : [];

  const orderId = body.order_id ? String(body.order_id) : undefined;

  const suggestions = await getUpsellSuggestions(locationId, cartItems);
  const impressionIds = await recordImpression(locationId, suggestions, cartItems, orderId);

  return NextResponse.json({ suggestions, impression_ids: impressionIds });
}
