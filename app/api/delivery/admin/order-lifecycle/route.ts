/**
 * GET  /api/delivery/admin/order-lifecycle              — Dashboard
 * POST /api/delivery/admin/order-lifecycle action=rebuild — Neue Snapshots erstellen
 * POST /api/delivery/admin/order-lifecycle action=prune   — Alte Snapshots löschen
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import {
  getLifecycleDashboard,
  snapCompletedOrders,
  pruneOldLifecycleSnapshots,
} from '@/lib/delivery/order-lifecycle';

export const dynamic = 'force-dynamic';

async function resolveContext(req: NextRequest): Promise<{ locationId: string } | null> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const qp = req.nextUrl.searchParams.get('location_id');
  if (qp) return { locationId: qp };

  const svc = createServiceClient();
  const { data: emp } = await svc
    .from('employees')
    .select('location_id')
    .eq('id', user.id)
    .maybeSingle();

  if (!emp?.location_id) return null;
  return { locationId: emp.location_id as string };
}

export async function GET(req: NextRequest) {
  const ctx = await resolveContext(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const dashboard = await getLifecycleDashboard(ctx.locationId);
    return NextResponse.json({ ok: true, ...dashboard });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const ctx = await resolveContext(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { action?: string; days?: number };
  const action = body.action ?? 'rebuild';

  try {
    if (action === 'rebuild') {
      const snapped = await snapCompletedOrders(ctx.locationId);
      return NextResponse.json({ ok: true, snapped });
    }

    if (action === 'prune') {
      const days = typeof body.days === 'number' ? body.days : 60;
      const deleted = await pruneOldLifecycleSnapshots(days);
      return NextResponse.json({ ok: true, deleted });
    }

    return NextResponse.json({ error: `Unbekannte Aktion: ${action}` }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
