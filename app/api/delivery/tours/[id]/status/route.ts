/**
 * PATCH /api/delivery/tours/[id]/status
 * Setzt den Status einer Tour (z.B. assigned → at_restaurant → on_route → delivered).
 * Bei Übergang → 'delivered': Driver-Rating wird neu berechnet (fire-and-forget).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { recomputeDriverRating } from '@/lib/delivery/rating';

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

  // Nach Tour-Abschluss: Driver-Rating neu berechnen (fire-and-forget)
  if (body.state === 'delivered') {
    const { data: batch } = await sb
      .from('mise_delivery_batches')
      .select('driver_id')
      .eq('id', params.id)
      .maybeSingle();

    if (batch?.driver_id) {
      recomputeDriverRating(batch.driver_id as string).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true, state: body.state });
}
