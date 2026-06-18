import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import {
  getIncentiveDashboard,
  getConfigs,
  upsertConfig,
  approvePendingIncentives,
  pruneOldIncentiveEvents,
  type IncentiveConfig,
} from '@/lib/delivery/driver-incentives';

export const dynamic = 'force-dynamic';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const qp = req.nextUrl.searchParams.get('location_id');
  if (qp) return qp;

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const svc = createServiceClient();
  const { data: emp } = await svc
    .from('employees')
    .select('location_id')
    .eq('id', user.id)
    .maybeSingle();
  return emp?.location_id ?? null;
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const action = req.nextUrl.searchParams.get('action') ?? 'dashboard';

  if (action === 'dashboard') {
    const dashboard = await getIncentiveDashboard(locationId);
    return NextResponse.json({ ok: true, dashboard });
  }

  if (action === 'configs') {
    const configs = await getConfigs(locationId);
    return NextResponse.json({ ok: true, configs });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as {
    action?: string;
    config?: Partial<IncentiveConfig>;
    keep_days?: number;
  };
  const action = body.action ?? 'upsert_config';

  if (action === 'upsert_config') {
    if (!body.config?.incentiveType) {
      return NextResponse.json({ error: 'incentiveType required' }, { status: 400 });
    }
    const cfg = await upsertConfig({
      locationId,
      incentiveType:     body.config.incentiveType,
      label:             body.config.label           ?? body.config.incentiveType,
      isActive:          body.config.isActive        ?? true,
      extraPct:          body.config.extraPct        ?? 0,
      qualityScoreMin:   body.config.qualityScoreMin ?? 70,
      flatEur:           body.config.flatEur         ?? 0,
      milestoneAt:       body.config.milestoneAt     ?? 10,
      milestoneBonusEur: body.config.milestoneBonusEur ?? 0,
      rushHourStart:     body.config.rushHourStart   ?? 11,
      rushHourEnd:       body.config.rushHourEnd     ?? 14,
      minOfflineHours:   body.config.minOfflineHours ?? 8,
      comebackBonusEur:  body.config.comebackBonusEur ?? 0,
    });
    return NextResponse.json({ ok: true, config: cfg });
  }

  if (action === 'approve') {
    const approved = await approvePendingIncentives(locationId);
    return NextResponse.json({ ok: true, approved });
  }

  if (action === 'prune') {
    const pruned = await pruneOldIncentiveEvents(body.keep_days ?? 90);
    return NextResponse.json({ ok: true, pruned });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
