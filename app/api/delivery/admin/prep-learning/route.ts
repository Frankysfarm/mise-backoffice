/**
 * GET  /api/delivery/admin/prep-learning
 *   → getPrepLearningDashboard(locationId)
 *
 * POST /api/delivery/admin/prep-learning
 *   body: { action: 'recompute' }        → recomputePrepProfilesForLocation(locationId)
 *   body: { action: 'estimate' }         → getSmartPrepEstimate(locationId)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getPrepLearningDashboard,
  recomputePrepProfilesForLocation,
  getSmartPrepEstimate,
} from '@/lib/delivery/kitchen-prep-learning';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: emp } = await supabase
    .from('employees')
    .select('location_id')
    .eq('auth_id', user.id)
    .single();

  if (emp?.location_id) return emp.location_id as string;

  const fromUrl = req.nextUrl.searchParams.get('location_id');
  return fromUrl ?? null;
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const dashboard = await getPrepLearningDashboard(locationId);
    return NextResponse.json(dashboard);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as { action?: string };
  const action = body.action ?? 'recompute';

  try {
    if (action === 'recompute') {
      const result = await recomputePrepProfilesForLocation(locationId);
      return NextResponse.json({ ok: true, ...result });
    }
    if (action === 'estimate') {
      const estimate = await getSmartPrepEstimate(locationId);
      return NextResponse.json({ ok: true, estimatedPrepMin: estimate });
    }
    return NextResponse.json({ error: `Unbekannte Aktion: ${action}` }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
