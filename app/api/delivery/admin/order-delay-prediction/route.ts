/**
 * GET  /api/delivery/admin/order-delay-prediction
 * POST /api/delivery/admin/order-delay-prediction
 *
 * Smart Order Delay Prediction Engine — Phase 316
 *
 * GET  ?action=dashboard   → KPIs + active predictions + accuracy
 * GET  ?action=active      → only active predictions list
 * POST action=predict_now  → batch-predict all pending orders now
 * POST action=settle       → settle outcomes for delivered orders
 * POST action=prune        → cleanup old settled predictions
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  getDelayPredictionDashboard,
  predictAllPendingOrders,
  settleOutcomes,
  pruneOldDelayPredictions,
} from '@/lib/delivery/order-delay-prediction';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(userId: string): Promise<string | null> {
  const svc = createServiceClient();
  const { data } = await svc
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', userId)
    .maybeSingle();
  return (data as { location_id?: string } | null)?.location_id ?? null;
}

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') ?? 'dashboard';
  const locationId = searchParams.get('location_id') ?? await resolveLocationId(user.id);
  if (!locationId) return NextResponse.json({ error: 'Keine Location' }, { status: 404 });

  if (action === 'dashboard' || action === 'active') {
    const dashboard = await getDelayPredictionDashboard(locationId);
    if (action === 'active') return NextResponse.json({ predictions: dashboard.activePredictions });
    return NextResponse.json(dashboard);
  }

  return NextResponse.json({ error: 'Unbekannte action' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const action = String(body.action ?? '');
  const locationId = typeof body.location_id === 'string'
    ? body.location_id
    : await resolveLocationId(user.id);
  if (!locationId) return NextResponse.json({ error: 'Keine Location' }, { status: 404 });

  if (action === 'predict_now') {
    const result = await predictAllPendingOrders(locationId);
    return NextResponse.json({ ok: true, ...result });
  }

  if (action === 'settle') {
    const result = await settleOutcomes(locationId);
    return NextResponse.json({ ok: true, ...result });
  }

  if (action === 'prune') {
    const daysOld = typeof body.days_old === 'number' ? body.days_old : 30;
    const result = await pruneOldDelayPredictions(daysOld);
    return NextResponse.json({ ok: true, ...result });
  }

  return NextResponse.json({ error: 'Unbekannte action' }, { status: 400 });
}
