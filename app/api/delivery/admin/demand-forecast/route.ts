/**
 * GET+POST /api/delivery/admin/demand-forecast
 *
 * Phase 201 — Smart Demand Forecasting accuracy dashboard
 *
 * GET  ?action=dashboard                → DemandForecastDashboard
 * POST { action: 'record_snapshot' }    → save current forecast slots
 * POST { action: 'fill_actuals' }       → fill in actual orders for past slots
 * POST { action: 'prune', days?: number } → delete old snapshots
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  getDemandForecastDashboard,
  recordForecastSnapshotsForLocation,
  fillActualsForLocation,
  pruneForecastSnapshots,
} from '@/lib/delivery/demand-forecast';

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

  if (!emp?.location_id) return null;
  if (!['manager', 'owner', 'admin', 'superadmin'].includes(emp.role as string)) return null;
  return emp.location_id as string;
}

export async function GET(req: NextRequest) {
  const locationId = await getLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const action = req.nextUrl.searchParams.get('action') ?? 'dashboard';

  try {
    if (action === 'dashboard') {
      const dashboard = await getDemandForecastDashboard(locationId);
      return NextResponse.json(dashboard);
    }
    return NextResponse.json({ error: `Unbekannte action: ${action}` }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const locationId = await getLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { action?: string; days?: number };
  try { body = await req.json(); } catch { body = {}; }

  const { action, days = 60 } = body;

  try {
    if (action === 'record_snapshot') {
      const result = await recordForecastSnapshotsForLocation(locationId);
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === 'fill_actuals') {
      const result = await fillActualsForLocation(locationId);
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === 'prune') {
      const pruned = await pruneForecastSnapshots(days);
      return NextResponse.json({ ok: true, pruned });
    }

    return NextResponse.json({ error: `Unbekannte action: ${action}` }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
