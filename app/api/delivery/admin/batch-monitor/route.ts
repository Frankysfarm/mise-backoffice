/**
 * GET /api/delivery/admin/batch-monitor
 *
 * action=dashboard   — Live-Scan + 24h-Trend + Heute-Statistik
 * action=scan        — Nur aktueller Scan (kein DB-Write)
 * action=details     — Detailliste aller aktiven Batches
 *
 * POST
 * action=snapshot    — Scan + in DB schreiben (manuell oder via Cron)
 * action=prune       — Alte Snapshots löschen
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getBatchMonitorDashboard,
  scanBatchHealth,
  getActiveBatchDetails,
  snapshotBatchHealth,
  pruneBatchHealthSnapshots,
} from '@/lib/delivery/smart-batch-monitor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const loc = new URL(req.url).searchParams.get('location_id');
  if (loc) return loc;

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .single();

  return (emp?.location_id as string | null) ?? null;
}

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const locationId = await resolveLocationId(req);
  if (!locationId) {
    return NextResponse.json({ error: 'Kein Standort zugeordnet' }, { status: 400 });
  }

  const action = new URL(req.url).searchParams.get('action') ?? 'dashboard';

  if (action === 'dashboard') {
    const data = await getBatchMonitorDashboard(locationId);
    return NextResponse.json(data);
  }

  if (action === 'scan') {
    const data = await scanBatchHealth(locationId);
    return NextResponse.json(data);
  }

  if (action === 'details') {
    const data = await getActiveBatchDetails(locationId);
    return NextResponse.json(data);
  }

  return NextResponse.json({ error: 'Unbekannte action' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const locationId = await resolveLocationId(req);
  if (!locationId) {
    return NextResponse.json({ error: 'Kein Standort zugeordnet' }, { status: 400 });
  }

  let body: { action?: string; days?: number } = {};
  try { body = await req.json(); } catch { /* leer ok */ }

  const action = body.action ?? 'snapshot';

  if (action === 'snapshot') {
    const data = await snapshotBatchHealth(locationId);
    return NextResponse.json({ ok: true, data });
  }

  if (action === 'prune') {
    const deleted = await pruneBatchHealthSnapshots(body.days ?? 14);
    return NextResponse.json({ ok: true, deleted });
  }

  return NextResponse.json({ error: 'Unbekannte action' }, { status: 400 });
}
