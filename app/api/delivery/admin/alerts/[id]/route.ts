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
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import { resolveAlert } from '@/lib/delivery/alerts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { id } = await params;
  const body = await req.json() as { action?: string };

  if (body.action !== 'resolve') {
    return NextResponse.json({ error: 'action muss "resolve" sein' }, { status: 400 });
  }

  try {
    await resolveAlert(id, user.id);
    return NextResponse.json({ ok: true, id, resolved_by: user.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { id } = await params;

  try {
    const serviceSb = createServiceClient();
    const { error } = await serviceSb
      .from('delivery_alerts')
      .delete()
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, deleted: id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
