/**
 * GET  /api/delivery/admin/smart-tip-engine?location_id=...
 *        → Dashboard (default) | ?action=config
 *
 * POST /api/delivery/admin/smart-tip-engine
 * Body: { action, location_id, ...params }
 *   action=update_config  — Konfiguration speichern
 *   action=calculate      — Vorschläge für eine Bestellung berechnen { order_id }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getSmartTipDashboard,
  getSmartTipConfig,
  upsertSmartTipConfig,
  calculateSmartTipSuggestions,
  recordSuggestionShown,
} from '@/lib/delivery/smart-tip-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const fromQs = req.nextUrl.searchParams.get('location_id');
  if (fromQs) return fromQs;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('user_id', user.id)
    .maybeSingle();
  return (emp?.location_id as string | null) ?? null;
}

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const action = req.nextUrl.searchParams.get('action') ?? 'dashboard';

  if (action === 'config') {
    const config = await getSmartTipConfig(locationId);
    return NextResponse.json({ ok: true, config });
  }

  const dashboard = await getSmartTipDashboard(locationId);
  return NextResponse.json({ ok: true, ...dashboard });
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const locationId = (body.location_id as string | null)
    ?? await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const action = body.action as string;

  if (action === 'update_config') {
    const cfg = await upsertSmartTipConfig(locationId, {
      isEnabled: body.is_enabled as boolean | undefined,
      basePct: body.base_pct as number | undefined,
      boostPctPunctual: body.boost_pct_punctual as number | undefined,
      penaltyPctLate: body.penalty_pct_late as number | undefined,
      driverScoreBoost: body.driver_score_boost as boolean | undefined,
      minSuggestionEur: body.min_suggestion_eur as number | undefined,
      maxSuggestionEur: body.max_suggestion_eur as number | undefined,
    });
    return NextResponse.json({ ok: true, config: cfg });
  }

  if (action === 'calculate') {
    const orderId = body.order_id as string | undefined;
    if (!orderId) return NextResponse.json({ error: 'order_id fehlt' }, { status: 400 });
    const sugg = await calculateSmartTipSuggestions(orderId, locationId);
    await recordSuggestionShown(orderId, locationId, sugg);
    return NextResponse.json({ ok: true, suggestions: sugg });
  }

  return NextResponse.json({ error: `Unbekannte Aktion: ${action}` }, { status: 400 });
}
