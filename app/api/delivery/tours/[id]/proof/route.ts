/**
 * POST /api/delivery/tours/[id]/proof
 * GET  /api/delivery/tours/[id]/proof?order_id=...
 *
 * POST: Fahrer reicht Liefernachweis ein (Foto-URL, Ablageort, Übergabe).
 *       Auth: eingeloggter Fahrer oder Admin — batch muss zu location gehören.
 * GET:  Admin ruft Nachweis für eine Bestellung ab.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { recordDeliveryProof, getOrderProof, type ProofType } from '@/lib/delivery/proof';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_PROOF_TYPES: ProofType[] = [
  'photo', 'left_at_door', 'neighbour', 'handed_to_person', 'contactless',
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

  // Batch laden → location_id holen + Autorisierung prüfen
  const { data: batch } = await sb
    .from('mise_delivery_batches')
    .select('id, location_id, driver_id')
    .eq('id', batchId)
    .maybeSingle();

  if (!batch) return NextResponse.json({ error: 'Tour nicht gefunden' }, { status: 404 });

  const locationId = batch.location_id as string;

  // Fahrer oder Admin-Mitarbeiter der Location
  const { data: employee } = await sb
    .from('employees')
    .select('id, location_id')
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
    stop_id?: string;
    order_id?: string;
    proof_type?: string;
    photo_url?: string | null;
    notes?: string | null;
    driver_lat?: number | null;
    driver_lng?: number | null;
  };

  if (!body.stop_id || !UUID_RE.test(body.stop_id)) {
    return NextResponse.json({ error: 'stop_id fehlt oder ungültig' }, { status: 400 });
  }
  if (!body.proof_type || !VALID_PROOF_TYPES.includes(body.proof_type as ProofType)) {
    return NextResponse.json({
      error: `proof_type ungültig. Erlaubt: ${VALID_PROOF_TYPES.join(', ')}`,
    }, { status: 400 });
  }
  if (body.order_id && !UUID_RE.test(body.order_id)) {
    return NextResponse.json({ error: 'order_id Format ungültig' }, { status: 400 });
  }
  if (body.photo_url && body.photo_url.length > 2048) {
    return NextResponse.json({ error: 'photo_url zu lang (max 2048)' }, { status: 400 });
  }
  if (body.notes && body.notes.length > 500) {
    return NextResponse.json({ error: 'notes zu lang (max 500 Zeichen)' }, { status: 400 });
  }

  const proof = await recordDeliveryProof(locationId, {
    tourStopId: body.stop_id,
    orderId:    body.order_id ?? null,
    batchId,
    proofType:  body.proof_type as ProofType,
    photoUrl:   body.photo_url ?? null,
    notes:      body.notes ?? null,
    driverLat:  body.driver_lat ?? null,
    driverLng:  body.driver_lng ?? null,
  });

  if (!proof) {
    return NextResponse.json(
      { error: 'Nachweis konnte nicht gespeichert werden (Migration 034 ausstehend?)' },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true, proof }, { status: 201 });
}

export async function GET(
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

  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get('order_id');
  if (!orderId || !UUID_RE.test(orderId)) {
    return NextResponse.json({ error: 'order_id fehlt oder ungültig' }, { status: 400 });
  }

  // Autorisierung: Mitarbeiter dieser Location
  const { data: batch } = await sb
    .from('mise_delivery_batches')
    .select('location_id')
    .eq('id', batchId)
    .maybeSingle();

  if (!batch) return NextResponse.json({ error: 'Tour nicht gefunden' }, { status: 404 });

  const { data: employee } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (employee?.location_id !== batch.location_id) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 });
  }

  const proof = await getOrderProof(orderId);
  return NextResponse.json({ proof: proof ?? null });
}
