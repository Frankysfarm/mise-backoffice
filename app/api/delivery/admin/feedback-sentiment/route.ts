/**
 * GET  /api/delivery/admin/feedback-sentiment
 *   ?action=dashboard           — Dashboard KPIs + Trend + Top-Keywords
 *   ?action=flagged&limit=50    — Geflaggte Kommentare
 *   ?action=feed&limit=30       — Live-Feed aller Kommentare
 *   ?action=driver&driver_id=   — Fahrer-Sentiment-Profil
 *   ?action=keywords&days=30    — Top-Keywords
 *
 * POST /api/delivery/admin/feedback-sentiment
 *   { action: 'analyze_all' }              — Alle unanalysierten analysieren
 *   { action: 'analyze_one', rating_id }   — Einzelne Bewertung analysieren
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  getSentimentDashboard,
  getFlaggedComments,
  getRecentCommentsFeed,
  getDriverSentimentProfile,
  getTopKeywords,
  processRating,
  processAllUnanalyzed,
} from '@/lib/delivery/feedback-sentiment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getLocationId(req: NextRequest): Promise<string | null> {
  void req;
  const sb = createServiceClient();
  const { data: { session } } = await sb.auth.getSession();
  if (!session?.user) return null;

  const { data } = await sb
    .from('employees')
    .select('location_id')
    .eq('user_id', session.user.id)
    .maybeSingle();

  return data?.location_id ?? null;
}

export async function GET(req: NextRequest) {
  const locationId = await getLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') ?? 'dashboard';

  try {
    if (action === 'dashboard') {
      const data = await getSentimentDashboard(locationId);
      return NextResponse.json(data);
    }

    if (action === 'flagged') {
      const limit = Math.min(100, Number(searchParams.get('limit') ?? 50));
      const data = await getFlaggedComments(locationId, limit);
      return NextResponse.json({ comments: data });
    }

    if (action === 'feed') {
      const limit = Math.min(100, Number(searchParams.get('limit') ?? 30));
      const data = await getRecentCommentsFeed(locationId, limit);
      return NextResponse.json({ comments: data });
    }

    if (action === 'driver') {
      const driverId = searchParams.get('driver_id');
      if (!driverId) return NextResponse.json({ error: 'driver_id fehlt' }, { status: 400 });
      const data = await getDriverSentimentProfile(driverId, locationId);
      return NextResponse.json({ profile: data });
    }

    if (action === 'keywords') {
      const days = Number(searchParams.get('days') ?? 30);
      const data = await getTopKeywords(locationId, days);
      return NextResponse.json({ keywords: data });
    }

    return NextResponse.json({ error: 'Unbekannte action' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const locationId = await getLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const action = body.action as string;

  try {
    if (action === 'analyze_all') {
      const result = await processAllUnanalyzed(locationId);
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === 'analyze_one') {
      const ratingId = body.rating_id as string;
      if (!ratingId) return NextResponse.json({ error: 'rating_id fehlt' }, { status: 400 });
      const result = await processRating(ratingId, locationId);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Unbekannte action' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
