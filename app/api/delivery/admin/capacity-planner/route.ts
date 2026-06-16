import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getCapacityDashboard,
  getCoverageGaps,
  generateCapacityPlanForLocation,
  pruneOldSlots,
} from '@/lib/delivery/capacity-planner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const { searchParams } = new URL(req.url);
  const paramId = searchParams.get('location_id');
  if (paramId) return paramId;

  const sb = await createClient();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return null;

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', session.user.id)
    .maybeSingle();

  return emp?.location_id ?? null;
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) {
    return NextResponse.json({ error: 'Unauthorized or missing location_id' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') ?? 'dashboard';

  if (action === 'gaps') {
    const gaps = await getCoverageGaps(locationId);
    return NextResponse.json({ ok: true, gaps });
  }

  // default: dashboard
  const dashboard = await getCapacityDashboard(locationId);
  return NextResponse.json({ ok: true, ...dashboard });
}

export async function POST(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) {
    return NextResponse.json({ error: 'Unauthorized or missing location_id' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as { action?: string; days?: number };
  const action = body.action ?? 'generate';

  if (action === 'generate') {
    const result = await generateCapacityPlanForLocation(locationId);
    return NextResponse.json({ ok: result.errors === 0, ...result });
  }

  if (action === 'prune') {
    const deleted = await pruneOldSlots(body.days ?? 14);
    return NextResponse.json({ ok: true, deleted });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
