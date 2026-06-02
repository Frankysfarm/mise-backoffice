/**
 * GET  /api/delivery/admin/satisfaction
 *   ?location_id=...&days=14
 *   → Zufriedenheits-Zusammenfassung (KPIs, Fahrer-Aufschlüsselung, Tages-Trend, Kommentare)
 *
 * POST /api/delivery/admin/satisfaction
 *   { action: 'generate_tokens', location_id }
 *   → Generiert Rating-Tokens für alle gelieferten Orders ohne Token
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSatisfactionSummary, generateMissingRatingTokens } from '@/lib/delivery/satisfaction';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const days = Math.min(90, Math.max(1, Number(searchParams.get('days') ?? '14')));

  if (!locationId) {
    return NextResponse.json({ error: 'location_id erforderlich' }, { status: 400 });
  }

  try {
    const summary = await getSatisfactionSummary(locationId, days);
    return NextResponse.json(summary, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[satisfaction] GET error:', err);
    // Graceful Fallback wenn Migration 022 noch nicht ausgeführt
    return NextResponse.json({
      totalRatings: 0,
      avgRating: 0,
      positiveRate: 0,
      negativeRate: 0,
      withComment: 0,
      byDay: [],
      byDriver: [],
      recentComments: [],
      _hint: 'Migration 022_customer_satisfaction.sql noch nicht ausgeführt',
    });
  }
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const body = await req.json() as { action?: string; location_id?: string };

  if (body.action === 'generate_tokens') {
    if (!body.location_id) {
      return NextResponse.json({ error: 'location_id erforderlich' }, { status: 400 });
    }
    const generated = await generateMissingRatingTokens(body.location_id);
    return NextResponse.json({ ok: true, generated });
  }

  return NextResponse.json({ error: `Unbekannte Aktion: ${body.action}` }, { status: 400 });
}
