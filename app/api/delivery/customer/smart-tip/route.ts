/**
 * GET /api/delivery/customer/smart-tip?order_id=...&location_id=...
 *
 * Öffentlicher Endpoint: Dynamische Trinkgeld-Vorschläge für eine gelieferte Bestellung.
 * Kein Auth nötig — Validierung über order_id.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  calculateSmartTipSuggestions,
  recordSuggestionShown,
  getSmartTipConfig,
} from '@/lib/delivery/smart-tip-engine';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get('order_id');
  const locationId = req.nextUrl.searchParams.get('location_id');

  if (!orderId || !locationId) {
    return NextResponse.json({ error: 'order_id und location_id erforderlich' }, { status: 400 });
  }

  try {
    const config = await getSmartTipConfig(locationId);
    if (!config.isEnabled) {
      return NextResponse.json({ ok: true, enabled: false, suggestions: null });
    }

    const suggestions = await calculateSmartTipSuggestions(orderId, locationId);
    await recordSuggestionShown(orderId, locationId, suggestions);

    return NextResponse.json({
      ok: true,
      enabled: true,
      suggestions: {
        low: suggestions.low,
        mid: suggestions.mid,
        high: suggestions.high,
        reason: suggestions.reason,
      },
    });
  } catch (err) {
    console.error('[smart-tip] GET error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
