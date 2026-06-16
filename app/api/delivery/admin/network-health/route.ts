import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getNetworkHealthDashboard,
  snapshotNetworkHealth,
  pruneOldNetworkSnapshots,
} from '@/lib/delivery/network-health';

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

  const dashboard = await getNetworkHealthDashboard(locationId);
  return NextResponse.json({ ok: true, ...dashboard });
}

export async function POST(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) {
    return NextResponse.json({ error: 'Unauthorized or missing location_id' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as { action?: string; days?: number };
  const action = body.action ?? 'snapshot';

  if (action === 'snapshot') {
    const snap = await snapshotNetworkHealth(locationId);
    return NextResponse.json({ ok: Boolean(snap), snapshot: snap });
  }

  if (action === 'prune') {
    const deleted = await pruneOldNetworkSnapshots(body.days ?? 90);
    return NextResponse.json({ ok: true, deleted });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
