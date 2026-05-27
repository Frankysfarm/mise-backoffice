import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/lieferdienst/orders/[id]/accept
 * Body: { etaMinutes?: number }
 *
 * Setzt Bestellung auf 'bestätigt' + speichert ETA.
 * Triggert trg_queue_customer_push → Kunde bekommt Push.
 * DEV-Modus: kein Auth.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const etaMinutes = Number(body?.etaMinutes) || null;

  const svc = createServiceClient();
  const patch: Record<string, unknown> = {
    status: 'bestätigt',
    bestaetigt_am: new Date().toISOString(),
  };
  if (etaMinutes != null && etaMinutes > 0) {
    patch.geschaetzte_zubereitung_min = etaMinutes;
  }

  const { data, error } = await svc.from('customer_orders')
    .update(patch)
    .eq('id', id)
    .select('id, status, bestaetigt_am, geschaetzte_zubereitung_min')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, order: data });
}
