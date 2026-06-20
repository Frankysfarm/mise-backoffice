/**
 * GET  /api/delivery/admin/geofence-auto-hours?location_id=...
 *        → Dashboard (default) | ?action=config
 *
 * POST /api/delivery/admin/geofence-auto-hours
 * Body: { action, location_id, ...params }
 *   action=update_config  — Konfiguration speichern
 *   action=check_now      — Sofortprüfung (manuell)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getAutoHoursDashboard,
  getAutoHoursConfig,
  upsertAutoHoursConfig,
  checkAndToggleLocation,
} from '@/lib/delivery/geofence-auto-hours';

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
    const config = await getAutoHoursConfig(locationId);
    return NextResponse.json({ ok: true, config });
  }

  const dashboard = await getAutoHoursDashboard(locationId);
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
    const cfg = await upsertAutoHoursConfig(locationId, {
      isEnabled: body.is_enabled as boolean | undefined,
      minDriversToOpen: body.min_drivers_to_open as number | undefined,
      autoOpenEnabled: body.auto_open_enabled as boolean | undefined,
      autoCloseEnabled: body.auto_close_enabled as boolean | undefined,
      gracePeriodMin: body.grace_period_min as number | undefined,
      openMessageDe: body.open_message_de as string | undefined,
      closeMessageDe: body.close_message_de as string | undefined,
    });
    return NextResponse.json({ ok: true, config: cfg });
  }

  if (action === 'check_now') {
    const result = await checkAndToggleLocation(locationId);
    return NextResponse.json({ ok: true, result });
  }

  return NextResponse.json({ error: `Unbekannte Aktion: ${action}` }, { status: 400 });
}
