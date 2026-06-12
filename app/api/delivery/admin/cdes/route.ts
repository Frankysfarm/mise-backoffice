/**
 * GET /api/delivery/admin/cdes
 *
 * Customer Delivery Experience Score (CDES) — Admin-API
 *
 * Query-Params:
 *   action      — 'stats' (default) | 'trend' | 'low_scores' | 'compute'
 *   location_id — UUID (optional, fallback via Auth → tenant_id)
 *   days        — 1–90, default 30 (für stats/trend)
 *   limit       — 1–100, default 20 (für low_scores)
 *
 * POST /api/delivery/admin/cdes
 *   body: { action: 'compute', order_id?: string }
 *   Triggert manuell Score-Berechnung (einzeln oder Batch für ganze Location)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getStats,
  getDailyTrend,
  getLowScoreOrders,
  computeExperienceScore,
  processUnscored,
} from '@/lib/delivery/cdes';

export const runtime  = 'nodejs';
export const dynamic  = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const qLoc = new URL(req.url).searchParams.get('location_id');
  if (qLoc && UUID_RE.test(qLoc)) return qLoc;

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  return (emp?.location_id as string | null) ?? null;
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url    = new URL(req.url);
  const action = url.searchParams.get('action') ?? 'stats';
  const days   = Math.min(90, Math.max(1, parseInt(url.searchParams.get('days') ?? '30', 10)));
  const limit  = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20', 10)));

  try {
    if (action === 'trend') {
      const trend = await getDailyTrend(locationId, days);
      return NextResponse.json({ trend });
    }

    if (action === 'low_scores') {
      const orders = await getLowScoreOrders(locationId, limit);
      return NextResponse.json({ orders });
    }

    // Default: 'stats' — gibt alles auf einmal zurück
    const [stats, trend, lowScores] = await Promise.all([
      getStats(locationId, days),
      getDailyTrend(locationId, Math.min(days, 14)),
      getLowScoreOrders(locationId, 10),
    ]);

    return NextResponse.json({ stats, trend, lowScores });
  } catch (err) {
    console.error('[cdes] GET error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await req.json()) as { action?: string; order_id?: string };

    if (body.action === 'compute' && body.order_id && UUID_RE.test(body.order_id)) {
      const score = await computeExperienceScore(body.order_id, locationId);
      if (!score) {
        return NextResponse.json({ error: 'Order nicht gefunden oder nicht geliefert' }, { status: 404 });
      }
      return NextResponse.json({ score });
    }

    // Batch: alle ungescore-ten Orders der Location berechnen
    const result = await processUnscored(locationId, 50);
    return NextResponse.json({ result });
  } catch (err) {
    console.error('[cdes] POST error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
