/**
 * POST /api/delivery/admin/tours/[id]/stops
 *
 * Fügt eine neue Bestellung als Stop in eine aktive Tour ein.
 * Body: { order_id: string }
 *
 * Nur für eingeloggte Admins. Location wird aus dem Employee-Profil bestimmt.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { insertStopIntoActiveTour } from '@/lib/delivery/tour-modifier';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!emp?.location_id) return NextResponse.json({ error: 'Kein Standort' }, { status: 403 });

  const body = await req.json() as { order_id?: string };
  if (!body.order_id) {
    return NextResponse.json({ error: 'order_id fehlt' }, { status: 400 });
  }

  const result = await insertStopIntoActiveTour(
    params.id,
    body.order_id,
    emp.location_id as string,
    user.id,
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 422 });
  }

  return NextResponse.json(result);
}
