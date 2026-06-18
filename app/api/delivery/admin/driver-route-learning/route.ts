/**
 * GET+POST /api/delivery/admin/driver-route-learning
 *
 * Phase 231 — Smart Driver Route Learning
 *
 * GET  ?action=dashboard              → RouteLearningDashboard
 * GET  ?action=suggest&plz=X,Y,Z      → DriverSuggestion[]
 * POST { action: 'rebuild' }          → BuildResult
 * POST { action: 'prune', days?: 120 } → { pruned }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  getRouteLearningDashboard,
  getDriverRouteSuggestion,
  buildRouteProfiles,
  pruneOldObservations,
} from '@/lib/delivery/driver-route-learning';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getLocationId(req: NextRequest): Promise<string | null> {
  const sb = createServiceClient();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return null;

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (emp?.location_id) return emp.location_id as string;
  return req.nextUrl.searchParams.get('location_id') ?? null;
}

export async function GET(req: NextRequest) {
  const locationId = await getLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const action = req.nextUrl.searchParams.get('action') ?? 'dashboard';

  if (action === 'dashboard') {
    const dashboard = await getRouteLearningDashboard(locationId);
    return NextResponse.json(dashboard);
  }

  if (action === 'suggest') {
    const plzParam = req.nextUrl.searchParams.get('plz') ?? '';
    const plzList  = plzParam.split(',').map((p) => p.trim()).filter(Boolean);
    const suggestions = await getDriverRouteSuggestion(locationId, plzList);
    return NextResponse.json(suggestions);
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const locationId = await getLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json()) as { action: string; days?: number };

  if (body.action === 'rebuild') {
    const result = await buildRouteProfiles(locationId);
    return NextResponse.json(result);
  }

  if (body.action === 'prune') {
    const result = await pruneOldObservations(body.days ?? 120);
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
