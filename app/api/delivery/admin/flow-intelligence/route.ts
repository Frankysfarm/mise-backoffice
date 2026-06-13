/**
 * GET  /api/delivery/admin/flow-intelligence  — Dashboard
 * POST /api/delivery/admin/flow-intelligence  — action: snapshot | detect | resolve
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getFlowDashboard,
  takeFlowSnapshot,
  detectAndHandleAnomalies,
  resolveStaleAnomalies,
} from '@/lib/delivery/flow-intelligence';

export const dynamic = 'force-dynamic';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const locFromQuery = req.nextUrl.searchParams.get('location_id');
  if (locFromQuery) return locFromQuery;

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  return (emp?.location_id as string | null) ?? null;
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  try {
    const dashboard = await getFlowDashboard(locationId);
    return NextResponse.json(dashboard);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = (body.action as string | undefined) ?? 'snapshot';

    if (action === 'snapshot') {
      const snapshot = await takeFlowSnapshot(locationId);
      if (!snapshot) {
        return NextResponse.json({ error: 'Snapshot fehlgeschlagen (Migration fehlt?)' }, { status: 500 });
      }
      const event = await detectAndHandleAnomalies(locationId, snapshot);
      return NextResponse.json({ ok: true, snapshot, anomaly_event: event });
    }

    if (action === 'resolve') {
      const resolved = await resolveStaleAnomalies(locationId, 'none');
      return NextResponse.json({ ok: true, resolved });
    }

    return NextResponse.json({ error: `Unbekannte Aktion: ${action}` }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
