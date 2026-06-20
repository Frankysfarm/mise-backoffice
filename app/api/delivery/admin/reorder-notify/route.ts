/**
 * GET  /api/delivery/admin/reorder-notify?location_id=...
 *        → Dashboard: offene Alerts + Push-Log
 *
 * POST /api/delivery/admin/reorder-notify
 * Body: { action, location_id, item_name? }
 *   action=scan_now      — Sofort-Scan für diesen Standort
 *   action=reset_dedup   — Push-Dedup für item_name zurücksetzen { item_name }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getReorderNotifyDashboard,
  scanItemAlertsAndNotify,
  resetPushDedup,
} from '@/lib/delivery/smart-reorder-notify';

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

  const dashboard = await getReorderNotifyDashboard(locationId);
  return NextResponse.json({ ok: true, ...dashboard });
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const locationId = (body.location_id as string | null) ?? await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const action = (body.action as string) ?? '';

  if (action === 'scan_now') {
    const result = await scanItemAlertsAndNotify(locationId);
    return NextResponse.json({ ok: true, ...result });
  }

  if (action === 'reset_dedup') {
    if (!body.item_name) return NextResponse.json({ error: 'item_name fehlt' }, { status: 400 });
    await resetPushDedup(locationId, body.item_name as string);
    return NextResponse.json({ ok: true, reset: body.item_name });
  }

  return NextResponse.json({ error: 'Unbekannte action' }, { status: 400 });
}
