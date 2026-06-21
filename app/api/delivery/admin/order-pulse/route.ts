/**
 * GET  /api/delivery/admin/order-pulse
 *      → Order-Pulse: 15-Min-Buckets, Trend, Hochrechnung nächste Stunde
 *
 * POST /api/delivery/admin/order-pulse
 *      body: { action: 'snapshot' }  → Cron: aktuellen Bucket in DB schreiben
 *      body: { action: 'prune', days?: number } → Alte Snapshots löschen
 *
 * Auth: eingeloggter Employee (Admin/Manager/Dispatcher)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getOrderPulse,
  snapshotOrderPulse,
  snapshotOrderPulseAllLocations,
  pruneOrderPulseSnapshots,
} from '@/lib/delivery/order-pulse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data: emp } = await sb
    .from('employees')
    .select('location_id, rolle')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  const validRoles = ['admin', 'manager', 'dispatcher'];
  if (!emp?.location_id || !validRoles.includes(emp.rolle as string)) return null;

  const paramId = req.nextUrl.searchParams.get('location_id');
  return (paramId ?? emp.location_id) as string;
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const pulse = await getOrderPulse(locationId);
    return NextResponse.json(pulse);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* ok */ }

  const action = String(body.action ?? '');

  if (action === 'snapshot') {
    await snapshotOrderPulse(locationId);
    return NextResponse.json({ ok: true, locationId });
  }

  if (action === 'snapshot-all') {
    const result = await snapshotOrderPulseAllLocations();
    return NextResponse.json({ ok: true, ...result });
  }

  if (action === 'prune') {
    const days = typeof body.days === 'number' ? body.days : 7;
    const deleted = await pruneOrderPulseSnapshots(days);
    return NextResponse.json({ ok: true, deleted });
  }

  return NextResponse.json({ error: `Unbekannte Action: ${action}` }, { status: 400 });
}
