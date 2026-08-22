/**
 * PATCH /api/delivery/kitchen/[orderId]/status
 * Setzt den Küchen-Status einer Bestellung (scheduled → cooking → ready → picked_up).
 */
import { NextRequest, NextResponse } from 'next/server';
import { markCooking, markReady, markPickedUp } from '@/lib/delivery/kitchen-sync';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { orderId: string } },
) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const body = await req.json() as { status?: string };

  switch (body.status) {
    case 'cooking':
      await markCooking(params.orderId);
      break;
    case 'ready':
      await markReady(params.orderId);
      break;
    case 'picked_up':
      await markPickedUp(params.orderId);
      break;
    default:
      return NextResponse.json(
        { error: 'Ungültiger Status. Erlaubt: cooking, ready, picked_up' },
        { status: 400 },
      );
  }

  return NextResponse.json({ ok: true, status: body.status });
}
