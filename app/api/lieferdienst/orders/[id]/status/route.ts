import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_STATUSES = new Set([
  'neu', 'bestätigt', 'in_zubereitung', 'fertig', 'unterwegs',
  'geliefert', 'abgeholt', 'storniert',
]);

const TIMESTAMP_COL: Record<string, string> = {
  'bestätigt': 'bestaetigt_am',
  'in_zubereitung': 'zubereitung_start',
  'fertig': 'fertig_am',
  'unterwegs': 'losgefahren_am',
  'geliefert': 'geliefert_am',
  'abgeholt': 'abgeholt_am',
  'storniert': 'storniert_am',
};

/**
 * PATCH /api/lieferdienst/orders/[id]/status
 * Body: { status: 'neu'|'bestätigt'|'in_zubereitung'|'fertig'|'unterwegs'|'geliefert'|'abgeholt'|'storniert' }
 *
 * Generischer Status-Wechsel. Status='fertig' triggert Frank-Dispatcher.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const status = String(body?.status ?? '').trim();

  if (!ALLOWED_STATUSES.has(status)) {
    return NextResponse.json({ error: `Status '${status}' ungültig` }, { status: 400 });
  }

  const svc = createServiceClient();
  const patch: Record<string, unknown> = { status };
  const tsCol = TIMESTAMP_COL[status];
  if (tsCol) patch[tsCol] = new Date().toISOString();

  const { data, error } = await svc.from('customer_orders')
    .update(patch)
    .eq('id', id)
    .select('id, status, bestaetigt_am, fertig_am, geliefert_am, mise_driver_id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, order: data });
}
