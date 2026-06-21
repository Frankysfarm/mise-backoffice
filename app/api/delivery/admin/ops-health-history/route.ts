/**
 * GET /api/delivery/admin/ops-health-history?location_id=...&hours=24
 *   Gibt stündlich aggregierte Ops-Health-KPIs zurück (für Trend-Charts).
 *   Optional: ?action=summary → Summary-KPIs (Score heute, 7d, Trend, Worst-Hour)
 *
 * POST /api/delivery/admin/ops-health-history
 *   { action: 'snapshot', location_id } → manueller Snapshot
 *   { action: 'prune', days_old?: number } → Cleanup
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getOpsHealthHistory,
  getOpsHealthSummary,
  snapshotOpsHealth,
  pruneOpsHealthSnapshots,
} from '@/lib/delivery/ops-health-history';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const action = searchParams.get('action');
  const hours  = Math.min(168, Math.max(1, Number(searchParams.get('hours') ?? '24')));

  try {
    if (action === 'summary') {
      const summary = await getOpsHealthSummary(locationId);
      return NextResponse.json(summary);
    }

    const history = await getOpsHealthHistory(locationId, hours);
    return NextResponse.json({ locationId, hours, history });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    location_id?: string;
    days_old?: number;
  };

  try {
    if (body.action === 'snapshot') {
      if (!body.location_id) {
        return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });
      }
      const snap = await snapshotOpsHealth(body.location_id);
      return NextResponse.json({ ok: true, snapshot: snap });
    }

    if (body.action === 'prune') {
      const result = await pruneOpsHealthSnapshots(body.days_old ?? 90);
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ error: 'Unbekannte action' }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
