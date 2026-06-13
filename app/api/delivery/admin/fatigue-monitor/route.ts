/**
 * GET  /api/delivery/admin/fatigue-monitor  — Dashboard (current states + alerts + trend)
 * POST /api/delivery/admin/fatigue-monitor
 *   action=snapshot  — Manuell Snapshot für alle Online-Fahrer auslösen
 *   action=resolve   — Einzelnen Alert auflösen  { alert_id, action_taken }
 *   action=snapshot_driver — Einzelnen Fahrer snapshotten  { driver_id }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import {
  getFatigueDashboard,
  snapshotFatigueAllDrivers,
  snapshotDriverFatigue,
  resolveFatigueAlert,
} from '@/lib/delivery/fatigue-monitor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(): Promise<string | null> {
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
  const locationId = await resolveLocationId();
  if (!locationId) return NextResponse.json({ error: 'Nicht eingeloggt oder keine Location' }, { status: 401 });

  try {
    const dashboard = await getFatigueDashboard(locationId);
    return NextResponse.json(dashboard);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const locationId = await resolveLocationId();
  if (!locationId) return NextResponse.json({ error: 'Nicht eingeloggt oder keine Location' }, { status: 401 });

  let body: Record<string, string> = {};
  try { body = await req.json(); } catch { /* empty ok */ }

  const action = body.action ?? 'snapshot';

  try {
    if (action === 'snapshot') {
      const result = await snapshotFatigueAllDrivers(locationId);
      return NextResponse.json({ ok: true, action, ...result });
    }

    if (action === 'snapshot_driver') {
      const { driver_id } = body;
      if (!driver_id) return NextResponse.json({ error: 'driver_id fehlt' }, { status: 400 });
      // Validate driver belongs to this location
      const sb = createServiceClient();
      const { data: drv } = await sb
        .from('mise_drivers')
        .select('id')
        .eq('id', driver_id)
        .eq('location_id', locationId)
        .maybeSingle();
      if (!drv) return NextResponse.json({ error: 'Fahrer nicht gefunden' }, { status: 404 });

      const snap = await snapshotDriverFatigue(locationId, driver_id);
      return NextResponse.json({ ok: true, action, snapshot: snap });
    }

    if (action === 'resolve') {
      const { alert_id, action_taken } = body;
      if (!alert_id) return NextResponse.json({ error: 'alert_id fehlt' }, { status: 400 });
      const ok = await resolveFatigueAlert(alert_id, action_taken ?? 'manual_resolve');
      return NextResponse.json({ ok, action });
    }

    return NextResponse.json({ error: `Unbekannte Aktion: ${action}` }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
