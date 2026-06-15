/**
 * GET+POST /api/delivery/admin/customer-value-score
 *
 * Phase 192 — Smart Customer Value Score (CVS) Engine
 *
 * GET  ?action=dashboard                         → CvsDashboard
 * GET  ?action=distribution                      → CvsDistribution | null
 * GET  ?action=top&limit=50                      → CustomerValueScore[]
 * GET  ?action=by_tier&tier=gold&limit=50        → CustomerValueScore[]
 * GET  ?action=profile&phone=+49...              → CustomerValueScore | null
 * POST { action: 'compute' }                     → CvsComputeResult
 * POST { action: 'prune', days?: number }        → { pruned: number }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  getCvsDashboard,
  getCvsDistribution,
  getTopCustomers,
  getCvsByTier,
  getCvsByPhone,
  computeCvsForLocation,
  pruneStaleScores,
  type CvsTier,
} from '@/lib/delivery/customer-value-score';

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

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') ?? 'dashboard';

  try {
    if (action === 'dashboard') {
      const dashboard = await getCvsDashboard(locationId);
      return NextResponse.json(dashboard);
    }

    if (action === 'distribution') {
      const dist = await getCvsDistribution(locationId);
      return NextResponse.json(dist);
    }

    if (action === 'top') {
      const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200);
      const customers = await getTopCustomers(locationId, limit);
      return NextResponse.json(customers);
    }

    if (action === 'by_tier') {
      const tier = (searchParams.get('tier') ?? 'gold') as CvsTier;
      const validTiers: CvsTier[] = ['bronze', 'silver', 'gold', 'platinum'];
      if (!validTiers.includes(tier)) {
        return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
      }
      const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200);
      const customers = await getCvsByTier(locationId, tier, limit);
      return NextResponse.json(customers);
    }

    if (action === 'profile') {
      const phone = searchParams.get('phone');
      if (!phone) return NextResponse.json({ error: 'phone required' }, { status: 400 });
      const profile = await getCvsByPhone(locationId, phone);
      return NextResponse.json(profile);
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const locationId = await getLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = (await req.json()) as { action: string; days?: number };

    if (body.action === 'compute') {
      const result = await computeCvsForLocation(locationId);
      return NextResponse.json(result);
    }

    if (body.action === 'prune') {
      const pruned = await pruneStaleScores(body.days ?? 45);
      return NextResponse.json({ pruned });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
