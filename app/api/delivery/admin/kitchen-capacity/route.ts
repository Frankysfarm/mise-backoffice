/**
 * GET  /api/delivery/admin/kitchen-capacity
 *   ?location_id=<uuid>&action=dashboard|trend|circuit-breaker-state
 *   ?location_id=<uuid>&action=trend&hours=24
 *   ?action=all-locations   — Multi-Location-Vergleich (kein location_id nötig)
 *   ?location_id=<uuid>&action=ml-features&hours=168
 *
 * POST /api/delivery/admin/kitchen-capacity
 *   { action: 'snapshot', location_id }
 *   { action: 'activate-circuit-breaker', location_id, reason, activated_by, duration_min? }
 *   { action: 'deactivate-circuit-breaker', location_id, reason }
 *   { action: 'prune', days_to_keep? }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  snapshotKitchenCapacity,
  getKitchenCapacityDashboard,
  getKitchenCapacityTrend,
  getCircuitBreakerState,
  activateCircuitBreaker,
  deactivateCircuitBreaker,
  pruneOldSnapshots,
  getMultiLocationCapacityComparison,
  exportMLFeatures,
} from '@/lib/delivery/kitchen-capacity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const fromQuery = req.nextUrl.searchParams.get('location_id');
  if (fromQuery) return fromQuery;

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .single();

  return (emp?.location_id as string | null) ?? null;
}

export async function GET(req: NextRequest) {
  try {
    const action = req.nextUrl.searchParams.get('action') ?? 'dashboard';

    // Multi-Location Vergleich braucht keine location_id
    if (action === 'all-locations') {
      const cards = await getMultiLocationCapacityComparison();
      return NextResponse.json({ cards, generatedAt: new Date().toISOString() });
    }

    const locationId = await resolveLocationId(req);

    if (!locationId) {
      return NextResponse.json({ error: 'location_id required' }, { status: 400 });
    }

    if (action === 'dashboard') {
      const dashboard = await getKitchenCapacityDashboard(locationId);
      return NextResponse.json(dashboard);
    }

    if (action === 'trend') {
      const hours = parseInt(req.nextUrl.searchParams.get('hours') ?? '24', 10);
      const trend = await getKitchenCapacityTrend(locationId, Math.min(hours, 48));
      return NextResponse.json({ locationId, hours, trend });
    }

    if (action === 'circuit-breaker-state') {
      const state = await getCircuitBreakerState(locationId);
      return NextResponse.json({ locationId, circuitBreaker: state });
    }

    if (action === 'ml-features') {
      const hours = parseInt(req.nextUrl.searchParams.get('hours') ?? '168', 10);
      const features = await exportMLFeatures(locationId, Math.min(hours, 720));
      return NextResponse.json({ locationId, rows: features.length, features });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    console.error('[kitchen-capacity GET]', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>;
    const action = body.action as string;

    if (action === 'snapshot') {
      const locationId = body.location_id as string;
      if (!locationId) {
        return NextResponse.json({ error: 'location_id required' }, { status: 400 });
      }
      const result = await snapshotKitchenCapacity(locationId);
      return NextResponse.json({
        ok:                 true,
        snapshot:           result.snapshot,
        circuitActivated:   result.circuitActivated,
        circuitDeactivated: result.circuitDeactivated,
      });
    }

    if (action === 'activate-circuit-breaker') {
      const locationId  = body.location_id as string;
      const reason      = (body.reason as string | undefined) ?? 'Manuell aktiviert';
      const activatedBy = (body.activated_by as string | undefined) ?? 'admin';
      const durationMin = body.duration_min != null ? Number(body.duration_min) : undefined;

      if (!locationId) {
        return NextResponse.json({ error: 'location_id required' }, { status: 400 });
      }

      const state = await activateCircuitBreaker({ locationId, reason, activatedBy, durationMin });
      return NextResponse.json({ ok: true, circuitBreaker: state });
    }

    if (action === 'deactivate-circuit-breaker') {
      const locationId = body.location_id as string;
      const reason     = (body.reason as string | undefined) ?? 'Manuell deaktiviert';

      if (!locationId) {
        return NextResponse.json({ error: 'location_id required' }, { status: 400 });
      }

      const state = await deactivateCircuitBreaker(locationId, reason);
      return NextResponse.json({ ok: true, circuitBreaker: state });
    }

    if (action === 'prune') {
      const daysToKeep = body.days_to_keep != null ? Number(body.days_to_keep) : 7;
      const result = await pruneOldSnapshots(daysToKeep);
      return NextResponse.json({ ok: true, pruned: result.pruned });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    console.error('[kitchen-capacity POST]', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
