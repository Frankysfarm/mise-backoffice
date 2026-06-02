/**
 * GET  /api/delivery/admin/recovery?location_id=...&limit=20
 *   → Recovery event history for a location
 *
 * POST /api/delivery/admin/recovery
 *   Body: { batch_id: string; reason?: string }
 *   → Manually trigger recovery for a cancelled (or stuck) batch
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getRecoveryEvents, recoverCancelledBatch } from '@/lib/delivery/recovery';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100);

  try {
    const events = await getRecoveryEvents(locationId, limit);
    return NextResponse.json({ events, count: events.length });
  } catch (err) {
    // Fallback wenn Migration noch nicht ausgeführt wurde
    return NextResponse.json({ events: [], count: 0, _note: 'Migration 021 noch nicht ausgeführt' });
  }
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const body = await req.json() as { batch_id?: string; reason?: string };
  if (!body.batch_id) return NextResponse.json({ error: 'batch_id fehlt' }, { status: 400 });

  const t0 = Date.now();
  const result = await recoverCancelledBatch(
    body.batch_id,
    body.reason ?? 'manual_admin',
    true,
  );

  return NextResponse.json({
    ...result,
    duration_ms: Date.now() - t0,
  });
}
