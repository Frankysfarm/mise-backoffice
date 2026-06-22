/**
 * GET /api/delivery/admin/strategic-insights?location_id=...
 *   → { summary, insights }  (alle aktiven Insights)
 *
 * GET ?location_id=...&category=sla
 *   → gefilterte Insights
 *
 * GET ?location_id=...&action=summary
 *   → nur InsightsSummary
 *
 * POST { action: 'generate', location_id }
 *   → { generated, errors }
 *
 * POST { action: 'acknowledge', insight_id, location_id }
 *   → { ok: boolean }
 *
 * POST { action: 'dismiss', insight_id, location_id }
 *   → { ok: boolean }
 *
 * POST { action: 'prune', days_old? }
 *   → { pruned: number }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  generateStrategicInsights,
  generateStrategicInsightsAllLocations,
  getStrategicInsights,
  getInsightsSummary,
  acknowledgeInsight,
  dismissInsight,
  pruneOldInsights,
  type InsightCategory,
} from '@/lib/delivery/strategic-insights';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function requireAuth(req: NextRequest): Promise<{ userId: string; locationId: string } | NextResponse> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });
  const locationId = new URL(req.url).searchParams.get('location_id')
    ?? (await req.clone().json().catch(() => ({} as Record<string, unknown>)) as Record<string, unknown>)?.location_id as string | undefined
    ?? '';
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });
  return { userId: user.id, locationId };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const action = searchParams.get('action');
  const category = searchParams.get('category') as InsightCategory | null;

  if (action === 'summary') {
    const summary = await getInsightsSummary(locationId);
    return NextResponse.json({ ok: true, summary });
  }

  const insights = await getStrategicInsights(locationId, {
    category: category ?? undefined,
  });
  const summary = {
    total: insights.length,
    critical: insights.filter(i => i.severity === 'critical').length,
    warning: insights.filter(i => i.severity === 'warning').length,
    unacknowledged: insights.filter(i => !i.is_acknowledged).length,
  };

  return NextResponse.json({ ok: true, insights, summary });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const body = await req.json() as Record<string, unknown>;
  const action = body.action as string | undefined;

  if (action === 'generate') {
    const locationId = body.location_id as string | undefined;
    if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });
    const result = await generateStrategicInsights(locationId);
    return NextResponse.json({ ok: true, ...result });
  }

  if (action === 'generate-all') {
    const result = await generateStrategicInsightsAllLocations();
    return NextResponse.json({ ok: true, ...result });
  }

  if (action === 'acknowledge') {
    const insightId = body.insight_id as string | undefined;
    const locationId = body.location_id as string | undefined;
    if (!insightId || !locationId) return NextResponse.json({ error: 'insight_id + location_id fehlen' }, { status: 400 });
    const ok = await acknowledgeInsight(insightId, locationId);
    return NextResponse.json({ ok });
  }

  if (action === 'dismiss') {
    const insightId = body.insight_id as string | undefined;
    const locationId = body.location_id as string | undefined;
    if (!insightId || !locationId) return NextResponse.json({ error: 'insight_id + location_id fehlen' }, { status: 400 });
    const ok = await dismissInsight(insightId, locationId);
    return NextResponse.json({ ok });
  }

  if (action === 'prune') {
    const daysOld = typeof body.days_old === 'number' ? body.days_old : 30;
    const pruned = await pruneOldInsights(daysOld);
    return NextResponse.json({ ok: true, pruned });
  }

  return NextResponse.json({ error: `Unbekannte action: ${action ?? 'undefined'}` }, { status: 400 });
}
