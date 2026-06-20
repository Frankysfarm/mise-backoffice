/**
 * GET/POST /api/delivery/admin/delay-alert-push
 *
 * Phase 318 — Delay Alert Push Admin API
 *
 * GET  ?action=stats   — Tagesstatistik Delay-Alerts
 * POST action=scan_now — Manueller Scan: kritische Prognosen → Push senden
 * POST action=prune    — Alte Alert-Logs bereinigen
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  alertCriticalOrders,
  getDelayAlertStats,
  pruneOldDelayAlerts,
} from '@/lib/delivery/delay-alert-push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(req: NextRequest, body?: Record<string, unknown>): Promise<string | null> {
  const svc = createServiceClient();
  const { data: { user } } = await svc.auth.getUser();
  if (!user) return null;

  if (body?.location_id) return String(body.location_id);

  const { data: emp } = await svc
    .from('employees')
    .select('location_id')
    .eq('user_id', user.id)
    .maybeSingle();

  return (emp as { location_id: string } | null)?.location_id ?? null;
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const action = req.nextUrl.searchParams.get('action') ?? 'stats';

  if (action === 'stats') {
    const stats = await getDelayAlertStats(locationId);
    return NextResponse.json({ ok: true, stats });
  }

  return NextResponse.json({ error: 'Unbekannte action' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* no body */ }

  const locationId = await resolveLocationId(req, body);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const action = String(body.action ?? '');

  if (action === 'scan_now') {
    const result = await alertCriticalOrders(locationId);
    return NextResponse.json({ ok: true, result });
  }

  if (action === 'prune') {
    const daysOld = typeof body.days_old === 'number' ? body.days_old : 30;
    const result = await pruneOldDelayAlerts(daysOld);
    return NextResponse.json({ ok: true, result });
  }

  return NextResponse.json({ error: 'Unbekannte action' }, { status: 400 });
}
