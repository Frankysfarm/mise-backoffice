/**
 * GET  /api/delivery/admin/smart-upsell
 *       → Dashboard (KPIs + top pairs + rule performance)
 *       ?action=rules    → nur Regel-Liste
 *       ?action=pairs    → Top-Paar-Analyse
 *
 * POST /api/delivery/admin/smart-upsell
 * Body: { location_id, action, ...params }
 *   action=create_rule   { name, trigger_item, suggested_item, headline?, badge?, extra_fee_eur?, priority?, max_per_day? }
 *   action=update_rule   { rule_id, ...updates }
 *   action=delete_rule   { rule_id }
 *   action=rebuild       — manueller Pair-Rebuild für diese Location
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getDashboard,
  getRules,
  getTopPairs,
  createRule,
  updateRule,
  deleteRule,
  rebuildUpsellPairs,
} from '@/lib/delivery/smart-upsell';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const fromParam = new URL(req.url).searchParams.get('location_id');
  if (fromParam) return fromParam;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('id', user.id)
    .maybeSingle();
  return emp?.location_id ?? null;
}

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const action = new URL(req.url).searchParams.get('action');

  if (action === 'rules') {
    const rules = await getRules(locationId);
    return NextResponse.json({ rules });
  }

  if (action === 'pairs') {
    const limit = Number(new URL(req.url).searchParams.get('limit') ?? '30');
    const pairs = await getTopPairs(locationId, Math.min(limit, 100));
    return NextResponse.json({ pairs });
  }

  const dashboard = await getDashboard(locationId);
  return NextResponse.json(dashboard);
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const body = await req.json() as Record<string, unknown>;
  const locationId = (body.location_id as string | undefined) ?? await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const action = body.action as string;

  try {
    if (action === 'create_rule') {
      const rule = await createRule(locationId, {
        name:           String(body.name ?? ''),
        trigger_item:   String(body.trigger_item ?? ''),
        suggested_item: String(body.suggested_item ?? ''),
        headline:       body.headline as string | undefined,
        badge:          body.badge as string | undefined,
        extra_fee_eur:  Number(body.extra_fee_eur ?? 0),
        priority:       Number(body.priority ?? 0),
        max_per_day:    body.max_per_day != null ? Number(body.max_per_day) : null,
      });
      return NextResponse.json({ ok: true, rule });
    }

    if (action === 'update_rule') {
      const ruleId = String(body.rule_id ?? '');
      if (!ruleId) return NextResponse.json({ error: 'rule_id fehlt' }, { status: 400 });
      await updateRule(ruleId, {
        name:           body.name as string | undefined,
        trigger_item:   body.trigger_item as string | undefined,
        suggested_item: body.suggested_item as string | undefined,
        headline:       body.headline as string | undefined,
        badge:          body.badge as string | undefined,
        extra_fee_eur:  body.extra_fee_eur != null ? Number(body.extra_fee_eur) : undefined,
        is_active:      body.is_active as boolean | undefined,
        priority:       body.priority != null ? Number(body.priority) : undefined,
        max_per_day:    body.max_per_day != null ? Number(body.max_per_day) : undefined,
      });
      return NextResponse.json({ ok: true });
    }

    if (action === 'delete_rule') {
      const ruleId = String(body.rule_id ?? '');
      if (!ruleId) return NextResponse.json({ error: 'rule_id fehlt' }, { status: 400 });
      await deleteRule(ruleId);
      return NextResponse.json({ ok: true });
    }

    if (action === 'rebuild') {
      const result = await rebuildUpsellPairs(locationId);
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ error: 'Unbekannte action' }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
