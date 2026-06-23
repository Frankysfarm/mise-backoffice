/**
 * GET  /api/delivery/admin/schicht-benchmark?location_id=...&date=YYYY-MM-DD
 *      → Benchmarks für eine Location (heute oder angegebenes Datum)
 *
 * POST /api/delivery/admin/schicht-benchmark
 *      action=compute          → Berechnet Benchmarks für Location (heute)
 *      action=compute-all      → Alle Standorte (Cron-Trigger)
 *      action=prune            → Alte Benchmarks löschen
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  computeBenchmarks,
  computeBenchmarksAllLocations,
  getBenchmarks,
  pruneOldBenchmarks,
} from '@/lib/delivery/schicht-benchmark';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getEmployee(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('employees')
    .select('id, location_id, role')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  return data as { id: string; location_id: string; role: string } | null;
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const emp = await getEmployee(supabase);
    if (!emp) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const locationId = searchParams.get('location_id') ?? emp.location_id;
    const date = searchParams.get('date') ?? undefined;

    const benchmarks = await getBenchmarks(locationId, date);
    return NextResponse.json({ ok: true, benchmarks });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const emp = await getEmployee(supabase);
    if (!emp) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({})) as {
      action?: string;
      location_id?: string;
      date?: string;
    };
    const action = body.action;
    const locationId = body.location_id ?? emp.location_id;

    if (action === 'compute') {
      const result = await computeBenchmarks(locationId, body.date);
      return NextResponse.json({ ok: true, result });
    }

    if (action === 'compute-all') {
      const result = await computeBenchmarksAllLocations(body.date);
      return NextResponse.json({ ok: true, result });
    }

    if (action === 'prune') {
      const result = await pruneOldBenchmarks(60);
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
