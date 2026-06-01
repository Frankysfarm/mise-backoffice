/**
 * GET  /api/delivery/admin/alerts?location_id=...&view=active|history&limit=50
 *
 * Aktive oder historische Betriebsalarme einer Location.
 *
 * view=active  (default) — nur unaufgelöste Alarme
 * view=history            — letzten N Alarme (aktive + aufgelöste)
 *
 * POST /api/delivery/admin/alerts
 * Body: { location_id, action: 'evaluate' | 'resolve_all' }
 *
 * evaluate    — Alert-Regeln sofort prüfen (für Tests + manuelles Triggern)
 * resolve_all — Alle aktiven Alarme einer Location manuell auflösen
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getActiveAlerts,
  getAlertHistory,
  evaluateAlerts,
  resolveAlert,
} from '@/lib/delivery/alerts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const view  = searchParams.get('view') ?? 'active';
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));

  try {
    if (view === 'history') {
      const alerts = await getAlertHistory(locationId, limit);
      return NextResponse.json({ alerts, total: alerts.length });
    }

    const alerts = await getActiveAlerts(locationId);
    return NextResponse.json({
      alerts,
      total:    alerts.length,
      critical: alerts.filter((a) => a.severity === 'critical').length,
      warning:  alerts.filter((a) => a.severity === 'warning').length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const body = await req.json() as { location_id?: string; action?: string };
  const { location_id: locationId, action } = body;

  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });
  if (!action)     return NextResponse.json({ error: 'action fehlt' }, { status: 400 });

  try {
    if (action === 'evaluate') {
      const result = await evaluateAlerts(locationId);
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === 'resolve_all') {
      const active = await getActiveAlerts(locationId);
      await Promise.all(active.map((a) => resolveAlert(a.id, user.id)));
      return NextResponse.json({ ok: true, resolved: active.length });
    }

    return NextResponse.json({ error: `Unbekannte action: ${action}` }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
