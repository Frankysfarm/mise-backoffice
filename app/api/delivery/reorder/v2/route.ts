/**
 * GET /api/delivery/reorder/v2
 *     ?token=<rating_token>&limit=5
 *
 * Öffentlicher V2-Endpunkt (kein Auth) — Personalisierte Wiederbestellungs-
 * Vorschläge mit Saisonalität, Tageszeit-Boost und Recency-Scoring.
 *
 * Phase 302
 */
import { NextRequest, NextResponse } from 'next/server';
import { getReorderSuggestionsV2ByToken } from '@/lib/delivery/reorder-engine-v2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'token erforderlich' }, { status: 400 });
  }

  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 5), 10);

  try {
    const result = await getReorderSuggestionsV2ByToken(token, limit);
    if (!result) {
      return NextResponse.json({ suggestions: [], version: 'v2' });
    }
    return NextResponse.json({
      suggestions:    result.suggestions,
      hasHistory:     result.suggestions.length > 0,
      seasonal_boost: result.seasonalBoost,
      version:        'v2',
    });
  } catch (err) {
    console.error('[reorder/v2 GET]', err);
    return NextResponse.json({ suggestions: [], version: 'v2' });
  }
}
