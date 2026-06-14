/**
 * GET /api/delivery/reorder
 *     ?token=<rating_token>&limit=5
 *
 * Öffentlicher Endpunkt (kein Auth) — gibt Wiederbestellungs-Vorschläge
 * für einen Kunden zurück, identifiziert via Rating-Token.
 *
 * Kein Datenschutz-Problem: Token-Lookup gibt nur item-Namen und Häufigkeit
 * zurück, keine vollständige Bestellhistorie.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getReorderSuggestionsByToken } from '@/lib/delivery/reorder-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'token erforderlich' }, { status: 400 });
  }

  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 5), 10);

  try {
    const result = await getReorderSuggestionsByToken(token, limit);
    if (!result) {
      return NextResponse.json({ suggestions: [] });
    }
    return NextResponse.json({
      suggestions: result.suggestions,
      hasHistory:  result.suggestions.length > 0,
    });
  } catch (err) {
    console.error('[reorder GET]', err);
    return NextResponse.json({ suggestions: [] });
  }
}
