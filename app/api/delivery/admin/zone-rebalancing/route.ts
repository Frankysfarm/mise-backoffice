/**
 * GET  /api/delivery/admin/zone-rebalancing              — Dashboard
 * GET  /api/delivery/admin/zone-rebalancing?action=history — Verlauf
 * POST /api/delivery/admin/zone-rebalancing action=suggest  — Neuen Vorschlag erstellen
 * POST /api/delivery/admin/zone-rebalancing action=apply    — Vorschlag anwenden
 * POST /api/delivery/admin/zone-rebalancing action=dismiss  — Vorschlag verwerfen
 * POST /api/delivery/admin/zone-rebalancing action=prune    — Snapshots bereinigen
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import {
  getDashboard,
  getRebalancingHistory,
  suggestRebalancing,
  analyzeZoneCapacity,
  createRebalancingEvent,
  applyRebalancing,
  dismissRebalancing,
  pruneOldSnapshots,
} from '@/lib/delivery/zone-rebalancing';

export const dynamic = 'force-dynamic';

async function resolveContext(req: NextRequest): Promise<{ locationId: string; userId: string } | null> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const qp = req.nextUrl.searchParams.get('location_id');
  if (qp) return { locationId: qp, userId: user.id };

  const svc = createServiceClient();
  const { data: emp } = await svc
    .from('employees')
    .select('location_id')
    .eq('id', user.id)
    .maybeSingle();

  if (!emp?.location_id) return null;
  return { locationId: emp.location_id, userId: user.id };
}

export async function GET(req: NextRequest) {
  const ctx = await resolveContext(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const action = req.nextUrl.searchParams.get('action') ?? 'dashboard';

  if (action === 'dashboard') {
    const dashboard = await getDashboard(ctx.locationId);
    return NextResponse.json({ ok: true, dashboard });
  }

  if (action === 'history') {
    const limit = Number(req.nextUrl.searchParams.get('limit') ?? '30');
    const history = await getRebalancingHistory(ctx.locationId, limit);
    return NextResponse.json({ ok: true, history });
  }

  if (action === 'capacity') {
    const load = await analyzeZoneCapacity(ctx.locationId);
    return NextResponse.json({ ok: true, load });
  }

  return NextResponse.json({ error: 'Unbekannte action' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const ctx = await resolveContext(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as {
    action?: string;
    eventId?: string;
    notes?: string;
    daysToKeep?: number;
  };
  const action = body.action ?? '';

  if (action === 'suggest') {
    const suggestion = await suggestRebalancing(ctx.locationId);
    if (!suggestion) {
      return NextResponse.json({ ok: true, suggestion: null, message: 'Kein Ungleichgewicht erkannt' });
    }
    const currentLoad = await analyzeZoneCapacity(ctx.locationId);
    const event = await createRebalancingEvent(ctx.locationId, suggestion, currentLoad);
    return NextResponse.json({ ok: true, event, suggestion });
  }

  if (action === 'apply') {
    if (!body.eventId) return NextResponse.json({ error: 'eventId erforderlich' }, { status: 400 });
    const event = await applyRebalancing(ctx.locationId, body.eventId, ctx.userId, body.notes);
    return NextResponse.json({ ok: true, event });
  }

  if (action === 'dismiss') {
    if (!body.eventId) return NextResponse.json({ error: 'eventId erforderlich' }, { status: 400 });
    const result = await dismissRebalancing(ctx.locationId, body.eventId, body.notes);
    return NextResponse.json({ ok: true, ...result });
  }

  if (action === 'prune') {
    const days = body.daysToKeep ?? 30;
    const result = await pruneOldSnapshots(days);
    return NextResponse.json({ ok: true, ...result });
  }

  return NextResponse.json({ error: 'Unbekannte action' }, { status: 400 });
}
