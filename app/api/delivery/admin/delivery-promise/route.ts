/**
 * GET+POST /api/delivery/admin/delivery-promise
 *
 * Phase 229 — Smart Delivery Promise Engine
 *
 * GET  ?action=dashboard             → PromiseDashboard
 * GET  ?action=compute&zone=A        → PromiseWindow (preview)
 * POST { action: 'settle_pending' }  → { settled, errors }
 * POST { action: 'prune', days?: 90 } → { pruned }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  getPromiseDashboard,
  computePromise,
  settleAllPendingPromises,
  pruneOldPromises,
} from '@/lib/delivery/delivery-promise';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getLocationId(req: NextRequest): Promise<string | null> {
  const sb = createServiceClient();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return null;

  const { data: emp } = await sb
    .from('employees')
    .select('location_id, role')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (emp?.location_id) return emp.location_id as string;

  const qp = req.nextUrl.searchParams.get('location_id');
  return qp ?? null;
}

export async function GET(req: NextRequest) {
  const locationId = await getLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const action = req.nextUrl.searchParams.get('action') ?? 'dashboard';

  if (action === 'dashboard') {
    const dashboard = await getPromiseDashboard(locationId);
    return NextResponse.json(dashboard);
  }

  if (action === 'compute') {
    const zone = req.nextUrl.searchParams.get('zone') ?? undefined;
    const window_ = await computePromise(locationId, zone);
    return NextResponse.json(window_);
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const locationId = await getLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as {
    action?: string;
    days?: number;
  };
  const { action, days } = body;

  if (action === 'settle_pending') {
    const result = await settleAllPendingPromises(locationId);
    return NextResponse.json(result);
  }

  if (action === 'prune') {
    const result = await pruneOldPromises(days ?? 90);
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
