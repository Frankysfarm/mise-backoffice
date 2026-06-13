/**
 * GET  /api/delivery/admin/health-observatory?location_id=&action=dashboard|trend|audit
 * POST /api/delivery/admin/health-observatory
 *      body: { location_id, action: 'snapshot' | 'audit' }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getObservatoryDashboard,
  getHealthTrend,
  takeHealthSnapshot,
  runIsolationAudit,
  getLatestAuditResults,
} from '@/lib/delivery/health-observatory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(req: NextRequest): Promise<{ locationId: string | null; error?: NextResponse }> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { locationId: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const { data: emp } = await sb
    .from('employees')
    .select('location_id, tenant_id')
    .eq('id', user.id)
    .maybeSingle();

  const fromQs = req.nextUrl.searchParams.get('location_id');
  const locationId = fromQs ?? emp?.location_id ?? null;
  if (!locationId) return { locationId: null, error: NextResponse.json({ error: 'location_id required' }, { status: 400 }) };
  return { locationId };
}

export async function GET(req: NextRequest) {
  const { locationId, error } = await resolveLocationId(req);
  if (error) return error;

  const action = req.nextUrl.searchParams.get('action') ?? 'dashboard';

  try {
    if (action === 'trend') {
      const hours = Math.min(72, Number(req.nextUrl.searchParams.get('hours') ?? 24));
      const trend = await getHealthTrend(locationId!, hours);
      return NextResponse.json({ trend });
    }

    if (action === 'audit') {
      const results = await getLatestAuditResults();
      return NextResponse.json({ audit_results: results });
    }

    // Default: full dashboard
    const dashboard = await getObservatoryDashboard(locationId!);
    return NextResponse.json(dashboard);
  } catch (e) {
    console.error('[health-observatory GET]', e);
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { location_id?: string; action?: string };
  const locationId = body.location_id ?? req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  const action = body.action ?? 'snapshot';

  try {
    if (action === 'audit') {
      const results = await runIsolationAudit();
      const critical = results.filter((r) => r.severity === 'critical').length;
      const warnings = results.filter((r) => r.severity === 'warning').length;
      return NextResponse.json({ ok: true, checked: results.length, critical, warnings, results });
    }

    // Default: take snapshot
    const snapshot = await takeHealthSnapshot(locationId);
    if (!snapshot) return NextResponse.json({ error: 'Snapshot fehlgeschlagen' }, { status: 500 });
    return NextResponse.json({ ok: true, snapshot });
  } catch (e) {
    console.error('[health-observatory POST]', e);
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
  }
}
