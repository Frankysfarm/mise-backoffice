import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import {
  getQualityDashboard,
  snapshotQualityScore,
  pruneOldScores,
} from '@/lib/delivery/quality-score';

export const dynamic = 'force-dynamic';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const qp = req.nextUrl.searchParams.get('location_id');
  if (qp) return qp;

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const svc = createServiceClient();
  const { data: emp } = await svc
    .from('employees')
    .select('location_id')
    .eq('id', user.id)
    .maybeSingle();
  return emp?.location_id ?? null;
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const action = req.nextUrl.searchParams.get('action') ?? 'dashboard';

  if (action === 'dashboard') {
    const dashboard = await getQualityDashboard(locationId);
    return NextResponse.json({ ok: true, dashboard });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { action?: string; date?: string; keep_days?: number };
  const action = body.action ?? 'snapshot';

  if (action === 'snapshot') {
    const snapshot = await snapshotQualityScore(locationId, body.date);
    return NextResponse.json({ ok: true, snapshot });
  }

  if (action === 'prune') {
    const pruned = await pruneOldScores(body.keep_days ?? 90);
    return NextResponse.json({ ok: true, pruned });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
