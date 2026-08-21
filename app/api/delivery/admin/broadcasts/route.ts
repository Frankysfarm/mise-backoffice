/**
 * GET  /api/delivery/admin/broadcasts?location_id=...
 * POST /api/delivery/admin/broadcasts
 * DELETE /api/delivery/admin/broadcasts?id=...&location_id=...
 *
 * Admin-Endpunkt: Betriebsnachrichten an Fahrer senden und verwalten.
 * Auth: eingeloggter Mitarbeiter, location_id aus Profil oder Query-Param.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  sendBroadcast,
  listBroadcasts,
  deleteBroadcast,
} from '@/lib/delivery/messaging';
import { getDeliveryAdminActor, isDeliveryAdminLocation } from '@/lib/delivery/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const actor = await getDeliveryAdminActor();
  if (!actor) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id') ?? actor.location_id;
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });
  if (!await isDeliveryAdminLocation(actor, locationId)) {
    return NextResponse.json({ error: 'Standort nicht autorisiert' }, { status: 403 });
  }

  const broadcasts = await listBroadcasts(locationId, 30);
  return NextResponse.json({ broadcasts });
}

export async function POST(req: NextRequest) {
  const actor = await getDeliveryAdminActor();
  if (!actor) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 });

  let body: {
    location_id?: string;
    message?: string;
    priority?: string;
    target?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiges JSON' }, { status: 400 });
  }

  const locationId = body.location_id ?? actor.location_id;
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });
  if (!await isDeliveryAdminLocation(actor, locationId)) {
    return NextResponse.json({ error: 'Standort nicht autorisiert' }, { status: 403 });
  }

  if (!body.message || typeof body.message !== 'string' || !body.message.trim()) {
    return NextResponse.json({ error: 'message fehlt oder leer' }, { status: 400 });
  }

  const priority = body.priority === 'urgent' ? 'urgent' : 'normal';
  const target   = typeof body.target === 'string' && body.target.trim() ? body.target.trim() : 'all';

  const sentByName = `${actor.vorname ?? ''} ${actor.nachname ?? ''}`.trim() || null;

  try {
    const result = await sendBroadcast({
      locationId,
      message: body.message,
      priority,
      target,
      sentByName: sentByName ?? undefined,
    });
    return NextResponse.json({ ok: true, id: result.id, created_at: result.createdAt });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Fehler beim Senden' },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  const actor = await getDeliveryAdminActor();
  if (!actor) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id         = searchParams.get('id');
  const locationId = searchParams.get('location_id') ?? actor.location_id;

  if (!id)         return NextResponse.json({ error: 'id fehlt' }, { status: 400 });
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });
  if (!await isDeliveryAdminLocation(actor, locationId)) {
    return NextResponse.json({ error: 'Standort nicht autorisiert' }, { status: 403 });
  }

  const deleted = await deleteBroadcast(id, locationId);
  return NextResponse.json({ ok: deleted });
}
