/**
 * GET  /api/delivery/admin/driver-score-benchmarks
 *   ?location_id=...&weeks=12   → WeeklyBenchmark[] Trend-Daten
 *   ?location_id=...&latest=1   → Aktuellster Benchmark
 *
 * POST /api/delivery/admin/driver-score-benchmarks
 *   { location_id, action: 'snapshot', week_start?: 'YYYY-MM-DD' }  → Snapshot anlegen
 *   { action: 'prune', days_old?: number }                           → Cleanup
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getWeeklyBenchmarks,
  getLatestBenchmark,
  snapshotWeeklyBenchmark,
  pruneOldBenchmarks,
} from '@/lib/delivery/driver-score-weekly-benchmarks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  if (searchParams.get('latest') === '1') {
    const benchmark = await getLatestBenchmark(locationId);
    return NextResponse.json({ benchmark, generated_at: new Date().toISOString() });
  }

  const weeks = Math.min(Number(searchParams.get('weeks') ?? 12), 52);
  const benchmarks = await getWeeklyBenchmarks(locationId, weeks);
  return NextResponse.json({ weeks, total: benchmarks.length, benchmarks, generated_at: new Date().toISOString() });
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  let body: { location_id?: string; action?: string; week_start?: string; days_old?: number };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Ungültiger Body' }, { status: 400 }); }

  if (body.action === 'prune') {
    const pruned = await pruneOldBenchmarks(body.days_old ?? 365);
    return NextResponse.json({ ok: true, pruned });
  }

  const locationId = body.location_id;
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const result = await snapshotWeeklyBenchmark(locationId, body.week_start);
  return NextResponse.json(result);
}
