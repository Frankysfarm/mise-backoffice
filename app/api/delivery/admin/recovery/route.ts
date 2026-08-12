/**
 * GET  /api/delivery/admin/recovery?location_id=...&limit=20
 *   → Recovery event history for a location
 *
 * POST /api/delivery/admin/recovery
 *   Body: { batch_id: string; reason?: string }
 *   → Manually trigger recovery for a cancelled (or stuck) batch
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getRecoveryEvents } from '@/lib/delivery/recovery';
import { getDeliveryAdminActor, isDeliveryAdminLocation } from '@/lib/delivery/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const actor = await getDeliveryAdminActor();
  if (!actor) return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });
  if (!await isDeliveryAdminLocation(actor, locationId)) return NextResponse.json({ error: 'Standort nicht gefunden' }, { status: 404 });

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
  const actor = await getDeliveryAdminActor();
  if (!actor) return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 });

  const body = await req.json() as { batch_id?: string; reason?: string };
  if (!body.batch_id) return NextResponse.json({ error: 'batch_id fehlt' }, { status: 400 });

  const svc = createServiceClient();
  const { data: batch } = await svc.from('mise_delivery_batches').select('location_id').eq('id', body.batch_id).maybeSingle();
  if (!batch?.location_id || !await isDeliveryAdminLocation(actor, batch.location_id as string)) return NextResponse.json({ error: 'Tour nicht gefunden' }, { status: 404 });
  const t0 = Date.now();
  const { data: result, error } = await svc.rpc('requeue_delivery_batch', {
    p_batch_id: body.batch_id,
    p_reason: body.reason ?? 'manual_admin',
    p_exclude_minutes: 10,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ...(result as Record<string, unknown>),
    duration_ms: Date.now() - t0,
  });
}
