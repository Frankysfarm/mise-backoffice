/**
 * GET+POST /api/delivery/admin/customer-cohorts
 *
 * Phase 227 — Smart Customer Cohort Revenue Analysis Engine
 *
 * GET  ?action=dashboard   → CohortDashboard
 * POST { action: 'rebuild' }           → BuildResult
 * POST { action: 'prune', days?: 730 } → { pruned: number }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  getCohortDashboard,
  buildCohortsForLocation,
  pruneOldSnapshots,
} from '@/lib/delivery/customer-cohorts';

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

  // Superadmin fallback
  const qp = req.nextUrl.searchParams.get('location_id');
  return qp ?? null;
}

export async function GET(req: NextRequest) {
  const locationId = await getLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const action = req.nextUrl.searchParams.get('action') ?? 'dashboard';

  if (action === 'dashboard') {
    const dashboard = await getCohortDashboard(locationId);
    return NextResponse.json(dashboard);
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const locationId = await getLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { action?: string; days?: number };
  const { action, days } = body;

  if (action === 'rebuild') {
    const result = await buildCohortsForLocation(locationId);
    return NextResponse.json(result);
  }

  if (action === 'prune') {
    const pruned = await pruneOldSnapshots(days ?? 730);
    return NextResponse.json({ pruned });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
