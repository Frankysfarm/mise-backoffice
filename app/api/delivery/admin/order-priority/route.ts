/**
 * GET  /api/delivery/admin/order-priority
 * POST /api/delivery/admin/order-priority
 *
 * KI-Auftrags-Priorisierungs-API — Phase 362.
 *
 * GET  ?action=dashboard                    → PriorityDashboard
 * GET  ?action=history&hours=24             → Stündlicher Score-Verlauf
 * POST { action: 'score' }                  → scoreAndPersistPendingOrders
 * POST { action: 'outcome', order_id, outcome } → Dispatch-Outcome markieren
 * POST { action: 'prune', days_old? }       → Alte Scores löschen
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getOrderPriorityDashboard,
  getOrderScoreHistory,
  scoreAndPersistPendingOrders,
  recordDispatchOutcome,
  pruneOrderPriorityScores,
} from '@/lib/delivery/order-priority-engine';

export const runtime  = 'nodejs';
export const dynamic  = 'force-dynamic';

async function resolveLocationId(userId: string): Promise<string | null> {
  const sb = await createClient();
  const { data: emp } = await sb
    .from('employees')
    .select('tenant_id')
    .eq('auth_user_id', userId)
    .maybeSingle();
  if (!emp?.tenant_id) return null;
  const { data: loc } = await sb
    .from('locations')
    .select('id')
    .eq('tenant_id', emp.tenant_id as string)
    .eq('active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return (loc?.id as string) ?? null;
}

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  let locationId = searchParams.get('location_id');
  if (!locationId) locationId = await resolveLocationId(user.id);
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const action = searchParams.get('action') ?? 'dashboard';

  if (action === 'history') {
    const hours = Math.min(168, parseInt(searchParams.get('hours') ?? '24', 10));
    const history = await getOrderScoreHistory(locationId, hours);
    return NextResponse.json({ history });
  }

  const dashboard = await getOrderPriorityDashboard(locationId);
  return NextResponse.json(dashboard);
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const body = await req.json() as {
    action: string;
    location_id?: string;
    order_id?: string;
    outcome?: string;
    days_old?: number;
  };

  let locationId = body.location_id;
  if (!locationId) locationId = await resolveLocationId(user.id) ?? undefined;
  if (!locationId && body.action !== 'outcome' && body.action !== 'prune') {
    return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });
  }

  switch (body.action) {
    case 'score': {
      if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });
      const result = await scoreAndPersistPendingOrders(locationId);
      return NextResponse.json(result);
    }
    case 'outcome': {
      if (!body.order_id || !body.outcome) {
        return NextResponse.json({ error: 'order_id und outcome erforderlich' }, { status: 400 });
      }
      const validOutcomes = ['dispatched', 'held', 'escalated', 'cancelled'];
      if (!validOutcomes.includes(body.outcome)) {
        return NextResponse.json({ error: 'Ungültiges outcome' }, { status: 400 });
      }
      await recordDispatchOutcome(
        body.order_id,
        body.outcome as 'dispatched' | 'held' | 'escalated' | 'cancelled',
      );
      return NextResponse.json({ ok: true });
    }
    case 'prune': {
      const result = await pruneOrderPriorityScores(body.days_old ?? 90);
      return NextResponse.json(result);
    }
    default:
      return NextResponse.json({ error: `Unbekannte action: ${body.action}` }, { status: 400 });
  }
}
