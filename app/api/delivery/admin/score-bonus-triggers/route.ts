/**
 * GET+POST /api/delivery/admin/score-bonus-triggers
 *
 * Fahrer-Score-Bonus-Trigger API — Phase 258
 *
 * GET  ?action=dashboard  → Trigger-Configs + Grants + KPIs
 * GET  ?action=triggers   → nur Trigger-Konfigurationen
 * GET  ?action=grants     → nur Grants (optional: ?status=pending|approved|paid|cancelled)
 *
 * POST action=evaluate         → Score-Trigger-Scan für Location
 * POST action=create_trigger   → Neuen Trigger anlegen
 * POST action=update_trigger   → Trigger bearbeiten (triggerId + Felder)
 * POST action=delete_trigger   → Trigger löschen
 * POST action=update_grant     → Grant-Status ändern (approve/pay/cancel)
 * POST action=prune            → Alte Grants bereinigen
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getScoreTriggerDashboard,
  getTriggers,
  getGrants,
  createTrigger,
  updateTrigger,
  deleteTrigger,
  evaluateScoreTriggersForLocation,
  updateGrantStatus,
  pruneOldGrants,
  type BonusTriggerType,
  type TriggerPeriod,
  type GrantStatus,
} from '@/lib/delivery/driver-score-trigger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function resolveLocationId(sb: Awaited<ReturnType<typeof createClient>>): Promise<string | null> {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  return emp?.location_id ?? null;
}

export async function GET(req: NextRequest) {
  try {
    const sb = await createClient();
    const locationId = await resolveLocationId(sb);
    if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') ?? 'dashboard';

    if (action === 'triggers') {
      const triggers = await getTriggers(locationId);
      return NextResponse.json({ triggers });
    }

    if (action === 'grants') {
      const status  = searchParams.get('status') as GrantStatus | null;
      const days    = parseInt(searchParams.get('days') ?? '60', 10);
      const grants  = await getGrants(locationId, { status: status ?? undefined, days });
      return NextResponse.json({ grants });
    }

    // action === 'dashboard' (default)
    const dashboard = await getScoreTriggerDashboard(locationId);
    return NextResponse.json(dashboard);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const sb = await createClient();
    const locationId = await resolveLocationId(sb);
    if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body   = await req.json() as Record<string, unknown>;
    const action = body.action as string | undefined;

    if (action === 'evaluate') {
      const result = await evaluateScoreTriggersForLocation(locationId);
      return NextResponse.json(result);
    }

    if (action === 'create_trigger') {
      const { label, score_threshold, bonus_type, bonus_value, period, score_period } = body;
      if (!label || score_threshold === undefined || !bonus_type || bonus_value === undefined) {
        return NextResponse.json({ error: 'label, score_threshold, bonus_type, bonus_value erforderlich' }, { status: 400 });
      }
      const trigger = await createTrigger({
        locationId,
        label:          label as string,
        scoreThreshold: Number(score_threshold),
        bonusType:      bonus_type as BonusTriggerType,
        bonusValue:     Number(bonus_value),
        period:         (period as TriggerPeriod) ?? 'week',
        scorePeriod:    (score_period as TriggerPeriod) ?? 'week',
        enabled:        true,
      });
      return NextResponse.json({ trigger });
    }

    if (action === 'update_trigger') {
      const { trigger_id, label, score_threshold, bonus_value, enabled } = body;
      if (!trigger_id) return NextResponse.json({ error: 'trigger_id erforderlich' }, { status: 400 });
      const trigger = await updateTrigger(trigger_id as string, locationId, {
        ...(label           !== undefined ? { label:          label as string }           : {}),
        ...(score_threshold !== undefined ? { scoreThreshold: Number(score_threshold) }   : {}),
        ...(bonus_value     !== undefined ? { bonusValue:     Number(bonus_value) }       : {}),
        ...(enabled         !== undefined ? { enabled:        Boolean(enabled) }          : {}),
      });
      return NextResponse.json({ trigger });
    }

    if (action === 'delete_trigger') {
      const { trigger_id } = body;
      if (!trigger_id) return NextResponse.json({ error: 'trigger_id erforderlich' }, { status: 400 });
      await deleteTrigger(trigger_id as string, locationId);
      return NextResponse.json({ ok: true });
    }

    if (action === 'update_grant') {
      const { grant_ids, status, resolved_eur } = body;
      if (!grant_ids || !Array.isArray(grant_ids) || !status) {
        return NextResponse.json({ error: 'grant_ids[] und status erforderlich' }, { status: 400 });
      }
      const validStatuses: GrantStatus[] = ['approved', 'paid', 'cancelled'];
      if (!validStatuses.includes(status as GrantStatus)) {
        return NextResponse.json({ error: 'status muss approved|paid|cancelled sein' }, { status: 400 });
      }
      const result = await updateGrantStatus(
        grant_ids as string[],
        status as 'approved' | 'paid' | 'cancelled',
        locationId,
        resolved_eur !== undefined ? Number(resolved_eur) : undefined,
      );
      return NextResponse.json(result);
    }

    if (action === 'prune') {
      const days = body.days !== undefined ? Number(body.days) : 90;
      const result = await pruneOldGrants(days);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
