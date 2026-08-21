/**
 * PATCH /api/delivery/admin/alerts/[id]
 * Body: { action: 'resolve' }
 *
 * Alarm manuell auflösen.
 *
 * DELETE /api/delivery/admin/alerts/[id]
 * Alarm dauerhaft löschen (nur für Tests / Bereinigung).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { resolveAlert } from '@/lib/delivery/alerts';
import { getDeliveryAdminActor, isDeliveryAdminLocation } from '@/lib/delivery/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getDeliveryAdminActor();
  if (!actor) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 });

  const { id } = await params;
  const body = await req.json() as { action?: string };

  if (body.action !== 'resolve') {
    return NextResponse.json({ error: 'action muss "resolve" sein' }, { status: 400 });
  }

  const serviceSb = createServiceClient();
  const { data: alert } = await serviceSb
    .from('delivery_alerts')
    .select('location_id')
    .eq('id', id)
    .maybeSingle();
  if (!alert) return NextResponse.json({ error: 'Alarm nicht gefunden' }, { status: 404 });
  if (!await isDeliveryAdminLocation(actor, alert.location_id as string)) {
    return NextResponse.json({ error: 'Standort nicht autorisiert' }, { status: 403 });
  }

  try {
    const resolvedBy = actor.auth_user_id ?? actor.id;
    await resolveAlert(id, resolvedBy);
    return NextResponse.json({ ok: true, id, resolved_by: resolvedBy });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getDeliveryAdminActor();
  if (!actor) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 });

  const { id } = await params;

  try {
    const serviceSb = createServiceClient();
    const { data: alert } = await serviceSb
      .from('delivery_alerts')
      .select('location_id')
      .eq('id', id)
      .maybeSingle();
    if (!alert) return NextResponse.json({ error: 'Alarm nicht gefunden' }, { status: 404 });
    if (!await isDeliveryAdminLocation(actor, alert.location_id as string)) {
      return NextResponse.json({ error: 'Standort nicht autorisiert' }, { status: 403 });
    }

    const { error } = await serviceSb
      .from('delivery_alerts')
      .delete()
      .eq('id', id)
      .eq('location_id', alert.location_id as string);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, deleted: id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
