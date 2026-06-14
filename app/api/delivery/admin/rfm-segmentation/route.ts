/**
 * GET/POST /api/delivery/admin/rfm-segmentation
 *
 * Phase 178 — RFM Customer Segmentation API
 *
 * GET  ?action=dashboard                          → RfmDashboard
 * GET  ?action=customers&segment=champion         → RfmProfile[]
 * GET  ?action=profile&phone=+49123...            → RfmProfile | null
 * GET  ?action=audience_size&segment=at_risk      → { size: number }
 * POST { action: 'compute' }                      → ComputeResult
 * POST { action: 'prune', days?: number }         → { pruned: number }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import {
  getRfmDashboard,
  getSegmentCustomers,
  getCustomerRfmProfile,
  getSegmentAudienceSize,
  computeRfmForLocation,
  pruneStaleRfmProfiles,
  type RfmSegment,
} from '@/lib/delivery/rfm-segmentation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getLocationId(req: NextRequest): Promise<string | null> {
  const sb = createServerClient();
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
      const dashboard = await getRfmDashboard(locationId);
      return NextResponse.json(dashboard);
    }

    if (action === 'customers') {
      const segment = (searchParams.get('segment') ?? 'champion') as RfmSegment;
      const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200);
      const customers = await getSegmentCustomers(locationId, segment, limit);
      return NextResponse.json({ customers });
    }

    if (action === 'profile') {
      const phone = searchParams.get('phone');
      if (!phone) return NextResponse.json({ error: 'phone required' }, { status: 400 });
      const profile = await getCustomerRfmProfile(locationId, phone);
      return NextResponse.json({ profile });
    }

    if (action === 'audience_size') {
      const segment = (searchParams.get('segment') ?? 'champion') as RfmSegment;
      const size = await getSegmentAudienceSize(locationId, segment);
      return NextResponse.json({ size });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('[rfm-segmentation GET]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const locationId = await getLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json() as { action: string; days?: number };

    if (body.action === 'compute') {
      const result = await computeRfmForLocation(locationId);
      return NextResponse.json(result);
    }

    if (body.action === 'prune') {
      const pruned = await pruneStaleRfmProfiles(body.days ?? 30);
      return NextResponse.json({ pruned });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('[rfm-segmentation POST]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
