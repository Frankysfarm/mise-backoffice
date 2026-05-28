/**
 * PATCH /api/delivery/tours/[id]/status
 * Setzt den Status einer Tour (z.B. assigned → at_restaurant → on_route → delivered).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_STATES = ['pending_acceptance', 'assigned', 'at_restaurant', 'on_route', 'delivered', 'cancelled'];

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const body = await req.json() as { state?: string };
  if (!body.state || !VALID_STATES.includes(body.state)) {
    return NextResponse.json({ error: `Ungültiger Status. Erlaubt: ${VALID_STATES.join(', ')}` }, { status: 400 });
  }

  const { error } = await sb
    .from('mise_delivery_batches')
    .update({ state: body.state })
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, state: body.state });
}
