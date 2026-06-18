/**
 * GET  /api/delivery/admin/benchmarking  — Dashboard + Ranking
 * POST /api/delivery/admin/benchmarking  — action=snapshot|export|prune
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import {
  getBenchmarkDashboard,
  snapshotBenchmark,
  snapshotAllLocations,
  exportBestPractices,
  pruneOldBenchmarks,
} from '@/lib/delivery/benchmarking';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(userId: string, qpLocationId?: string): Promise<string | null> {
  const svc = createServiceClient();
  if (qpLocationId) return qpLocationId;
  const { data } = await svc
    .from('employees')
    .select('location_id')
    .eq('user_id', userId)
    .maybeSingle();
  return (data?.location_id as string | null) ?? null;
}

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const qp = req.nextUrl.searchParams;
  const locationId = await resolveLocationId(user.id, qp.get('location_id') ?? undefined);
  if (!locationId) return NextResponse.json({ error: 'Location nicht gefunden' }, { status: 403 });

  try {
    const dashboard = await getBenchmarkDashboard(locationId);
    return NextResponse.json(dashboard);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const body = await req.json() as { action?: string; location_id?: string };
  const locationId = await resolveLocationId(user.id, body.location_id);
  if (!locationId) return NextResponse.json({ error: 'Location nicht gefunden' }, { status: 403 });

  const action = body.action ?? 'snapshot';

  try {
    if (action === 'snapshot_all') {
      const result = await snapshotAllLocations();
      return NextResponse.json({ ok: true, ...result });
    }
    if (action === 'snapshot') {
      const snap = await snapshotBenchmark(locationId);
      return NextResponse.json({ ok: true, snapshot: snap });
    }
    if (action === 'export') {
      const bp = await exportBestPractices(locationId);
      return NextResponse.json({ ok: true, bestPractice: bp });
    }
    if (action === 'prune') {
      const deleted = await pruneOldBenchmarks(90);
      return NextResponse.json({ ok: true, deleted });
    }
    return NextResponse.json({ error: `Unbekannte Aktion: ${action}` }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
