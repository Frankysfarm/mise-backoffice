/**
 * GET  /api/delivery/admin/order-rescue?action=dashboard|config
 * POST /api/delivery/admin/order-rescue
 *   { action: 'scan' | 'track_outcomes' | 'update_config' | 'apply_intervention' | 'prune',
 *     locationId?, config?, rescueEventId?, interventionType? }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getRescueDashboard,
  getRescueConfig,
  upsertRescueConfig,
  detectAtRiskOrders,
  trackOutcomes,
  applyRescueIntervention,
  pruneOldRescueEvents,
} from '@/lib/delivery/order-rescue';
import type { InterventionType } from '@/lib/delivery/order-rescue';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .single();

  return (emp?.location_id as string | null)
    ?? req.nextUrl.searchParams.get('location_id')
    ?? null;
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Nicht authentifiziert oder kein Standort' }, { status: 401 });

  const action = req.nextUrl.searchParams.get('action') ?? 'dashboard';

  if (action === 'config') {
    const config = await getRescueConfig(locationId);
    return NextResponse.json({ ok: true, config });
  }

  const dashboard = await getRescueDashboard(locationId);
  return NextResponse.json({ ok: true, dashboard });
}

export async function POST(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Nicht authentifiziert oder kein Standort' }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Ungültiges JSON' }, { status: 400 }); }

  const {
    action,
    config,
    rescueEventId,
    interventionType,
  } = body as {
    action:             string;
    config?:            Record<string, unknown>;
    rescueEventId?:     string;
    interventionType?:  InterventionType;
  };

  switch (action) {
    case 'scan': {
      const result = await detectAtRiskOrders(locationId);
      await trackOutcomes(locationId);
      return NextResponse.json({ ok: true, result });
    }

    case 'track_outcomes': {
      const result = await trackOutcomes(locationId);
      return NextResponse.json({ ok: true, result });
    }

    case 'update_config': {
      if (!config) return NextResponse.json({ error: 'config fehlt' }, { status: 400 });
      const updated = await upsertRescueConfig(locationId, {
        enabled:                   typeof config.enabled === 'boolean' ? config.enabled : undefined,
        riskThreshold:             typeof config.riskThreshold === 'number' ? config.riskThreshold : undefined,
        waitMinTrigger:            typeof config.waitMinTrigger === 'number' ? config.waitMinTrigger : undefined,
        etaOverrunTriggerMin:      typeof config.etaOverrunTriggerMin === 'number' ? config.etaOverrunTriggerMin : undefined,
        autoPushEnabled:           typeof config.autoPushEnabled === 'boolean' ? config.autoPushEnabled : undefined,
        autoPriorityBoostEnabled:  typeof config.autoPriorityBoostEnabled === 'boolean' ? config.autoPriorityBoostEnabled : undefined,
        autoVoucherEnabled:        typeof config.autoVoucherEnabled === 'boolean' ? config.autoVoucherEnabled : undefined,
        voucherValueEur:           typeof config.voucherValueEur === 'number' ? config.voucherValueEur : undefined,
      });
      return NextResponse.json({ ok: true, config: updated });
    }

    case 'apply_intervention': {
      if (!rescueEventId || !interventionType) {
        return NextResponse.json({ error: 'rescueEventId + interventionType erforderlich' }, { status: 400 });
      }
      const result = await applyRescueIntervention(rescueEventId, interventionType, locationId);
      return NextResponse.json({ ok: result.ok, interventionId: result.interventionId });
    }

    case 'prune': {
      const deleted = await pruneOldRescueEvents(30);
      return NextResponse.json({ ok: true, deleted });
    }

    default:
      return NextResponse.json({ error: `Unbekannte action: ${action}` }, { status: 400 });
  }
}
