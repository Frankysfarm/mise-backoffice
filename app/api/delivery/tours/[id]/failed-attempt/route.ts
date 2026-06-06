/**
 * POST /api/delivery/tours/[id]/failed-attempt
 *
 * Fahrer meldet einen fehlgeschlagenen Zustellversuch.
 * - Erstellt delivery_failed_attempts Eintrag
 * - Setzt customer_orders.status auf 'nicht_zugestellt'
 * - Auth: eingeloggter Fahrer dem diese Tour zugewiesen ist, oder Admin
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { recordFailedAttempt, type FailedReason } from '@/lib/delivery/proof';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_REASONS: FailedReason[] = [
  'no_answer', 'wrong_address', 'refused', 'access_denied', 'not_home', 'other',
];

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const batchId = params.id;
  if (!UUID_RE.test(batchId)) {
    return NextResponse.json({ error: 'Ungültige Batch-ID' }, { status: 400 });
  }

  // Batch laden → location_id + Autorisierung
  const { data: batch } = await sb
    .from('mise_delivery_batches')
    .select('id, location_id, driver_id')
    .eq('id', batchId)
    .maybeSingle();

  if (!batch) return NextResponse.json({ error: 'Tour nicht gefunden' }, { status: 404 });

  const locationId = batch.location_id as string;

  const { data: employee } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  const isAdmin = employee?.location_id === locationId;

  const { data: driver } = await sb
    .from('mise_drivers')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  const isAssignedDriver = driver && batch.driver_id === driver.id;

  if (!isAdmin && !isAssignedDriver) {
    return NextResponse.json({ error: 'Keine Berechtigung für diese Tour' }, { status: 403 });
  }

  const body = await req.json() as {
    stop_id?: string | null;
    order_id?: string;
    reason?: string;
    photo_url?: string | null;
    notes?: string | null;
    driver_lat?: number | null;
    driver_lng?: number | null;
  };

  if (!body.order_id || !UUID_RE.test(body.order_id)) {
    return NextResponse.json({ error: 'order_id fehlt oder ungültig' }, { status: 400 });
  }
  if (!body.reason || !VALID_REASONS.includes(body.reason as FailedReason)) {
    return NextResponse.json({
      error: `reason ungültig. Erlaubt: ${VALID_REASONS.join(', ')}`,
    }, { status: 400 });
  }
  if (body.stop_id && !UUID_RE.test(body.stop_id)) {
    return NextResponse.json({ error: 'stop_id Format ungültig' }, { status: 400 });
  }
  if (body.photo_url && body.photo_url.length > 2048) {
    return NextResponse.json({ error: 'photo_url zu lang (max 2048)' }, { status: 400 });
  }
  if (body.notes && body.notes.length > 500) {
    return NextResponse.json({ error: 'notes zu lang (max 500 Zeichen)' }, { status: 400 });
  }

  // Verifizieren dass diese Order zur Batch gehört (Tenant-Guard)
  const { data: stopCheck } = await sb
    .from('mise_delivery_batch_stops')
    .select('id')
    .eq('batch_id', batchId)
    .eq('order_id', body.order_id)
    .maybeSingle();

  if (!stopCheck && !isAdmin) {
    return NextResponse.json({ error: 'Bestellung gehört nicht zu dieser Tour' }, { status: 403 });
  }

  const attempt = await recordFailedAttempt(locationId, {
    tourStopId: body.stop_id ?? null,
    orderId:    body.order_id,
    batchId,
    driverId:   (driver?.id as string | null) ?? null,
    reason:     body.reason as FailedReason,
    photoUrl:   body.photo_url ?? null,
    notes:      body.notes ?? null,
    driverLat:  body.driver_lat ?? null,
    driverLng:  body.driver_lng ?? null,
  });

  if (!attempt) {
    return NextResponse.json(
      { error: 'Fehlversuch konnte nicht gespeichert werden (Migration 034 ausstehend?)' },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true, attempt }, { status: 201 });
}
