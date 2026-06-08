/**
 * GET  /api/delivery/admin/broadcasts?location_id=...
 * POST /api/delivery/admin/broadcasts
 * DELETE /api/delivery/admin/broadcasts?id=...&location_id=...
 *
 * Admin-Endpunkt: Betriebsnachrichten an Fahrer senden und verwalten.
 * Auth: eingeloggter Mitarbeiter, location_id aus Profil oder Query-Param.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  sendBroadcast,
  listBroadcasts,
  deleteBroadcast,
} from '@/lib/delivery/messaging';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(
  sb: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  queryLocationId: string | null,
): Promise<string | null> {
  if (queryLocationId) return queryLocationId;
  const { data } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', userId)
    .maybeSingle();
  return (data?.location_id as string | null) ?? null;
}

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const locationId = await resolveLocationId(sb, user.id, searchParams.get('location_id'));
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const broadcasts = await listBroadcasts(locationId, 30);
  return NextResponse.json({ broadcasts });
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

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

  const locationId = await resolveLocationId(sb, user.id, body.location_id ?? null);
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  if (!body.message || typeof body.message !== 'string' || !body.message.trim()) {
    return NextResponse.json({ error: 'message fehlt oder leer' }, { status: 400 });
  }

  const priority = body.priority === 'urgent' ? 'urgent' : 'normal';
  const target   = typeof body.target === 'string' && body.target.trim() ? body.target.trim() : 'all';

  // Sendernamen aus Employee-Profil lesen
  const { data: emp } = await sb
    .from('employees')
    .select('vorname, nachname')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  const sentByName =
    emp ? `${(emp.vorname as string | null) ?? ''} ${(emp.nachname as string | null) ?? ''}`.trim() || null
        : null;

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
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id         = searchParams.get('id');
  const locationId = await resolveLocationId(sb, user.id, searchParams.get('location_id'));

  if (!id)         return NextResponse.json({ error: 'id fehlt' }, { status: 400 });
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const deleted = await deleteBroadcast(id, locationId);
  return NextResponse.json({ ok: deleted });
}
