/**
 * GET  /api/delivery/admin/tour-completion
 *
 * Tour-Abschluss-Analyse für Admin.
 *
 * Query-Parameter:
 *   batch_id              — Vollständige Analyse für eine Tour
 *   action=list           — Liste abgeschlossener Touren
 *     &days=7             — Zeitraum in Tagen (default 7, max 90)
 *     &limit=30           — Max Einträge (default 30, max 100)
 *     &driver_id=...      — Filter auf einen Fahrer
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getTourCompletionReport,
  listCompletedTours,
} from '@/lib/delivery/tour-completion-analysis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(userId: string): Promise<string | null> {
  const sb = await createClient();
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', userId)
    .maybeSingle();
  return (emp?.location_id as string) ?? null;
}

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  let locationId = searchParams.get('location_id');
  if (!locationId) locationId = await resolveLocationId(user.id);
  if (!locationId)
    return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const batchId = searchParams.get('batch_id');
  if (batchId) {
    const report = await getTourCompletionReport(batchId, locationId);
    if (!report) return NextResponse.json({ error: 'Tour nicht gefunden' }, { status: 404 });
    return NextResponse.json({ ok: true, report });
  }

  const action = searchParams.get('action') ?? 'list';
  if (action === 'list') {
    const days = Math.min(90, Math.max(1, Number(searchParams.get('days') ?? 7)));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 30)));
    const driverId = searchParams.get('driver_id') ?? undefined;

    const tours = await listCompletedTours(locationId, { days, limit, driverId });
    return NextResponse.json({ ok: true, tours, count: tours.length });
  }

  return NextResponse.json({ error: 'Ungültige Aktion' }, { status: 400 });
}
