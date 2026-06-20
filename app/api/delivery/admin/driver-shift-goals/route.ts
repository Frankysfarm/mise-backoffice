/**
 * GET /api/delivery/admin/driver-shift-goals
 *   ?action=dashboard (default) | config | snapshot
 *
 * POST /api/delivery/admin/driver-shift-goals
 *   { action: 'update_config', targetStops?, targetEarningsEur?, targetScore?,
 *             shiftStartHour?, shiftHoursTotal? }
 *   { action: 'snapshot' }
 *   { action: 'prune', days? }
 *
 * Auth: Manager+ via employees.location_id
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  getDriverShiftGoalConfig,
  upsertDriverShiftGoalConfig,
  getDriverShiftGoalDashboard,
  snapshotDriverShiftGoals,
  pruneDriverShiftGoalSnapshots,
} from '@/lib/delivery/driver-shift-goals';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const override = new URL(req.url).searchParams.get('location_id');
  if (override) return override;

  const svc = createServiceClient();
  const { data: emp } = await svc
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  return (emp as { location_id?: string } | null)?.location_id ?? null;
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });

  const action = new URL(req.url).searchParams.get('action') ?? 'dashboard';

  if (action === 'config') {
    const config = await getDriverShiftGoalConfig(locationId);
    return NextResponse.json({ config });
  }

  const dashboard = await getDriverShiftGoalDashboard(locationId);
  return NextResponse.json(dashboard);
}

export async function POST(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });

  const body = await req.json() as Record<string, unknown>;
  const action = body.action as string;

  if (action === 'update_config') {
    await upsertDriverShiftGoalConfig(locationId, {
      targetStops:       body.targetStops       as number | undefined,
      targetEarningsEur: body.targetEarningsEur as number | undefined,
      targetScore:       body.targetScore       as number | undefined,
      shiftStartHour:    body.shiftStartHour    as number | undefined,
      shiftHoursTotal:   body.shiftHoursTotal   as number | undefined,
    });
    const config = await getDriverShiftGoalConfig(locationId);
    return NextResponse.json({ ok: true, config });
  }

  if (action === 'snapshot') {
    const result = await snapshotDriverShiftGoals(locationId);
    return NextResponse.json({ ok: true, ...result });
  }

  if (action === 'prune') {
    const days = typeof body.days === 'number' ? body.days : 7;
    const result = await pruneDriverShiftGoalSnapshots(days);
    return NextResponse.json({ ok: true, ...result });
  }

  return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 });
}
