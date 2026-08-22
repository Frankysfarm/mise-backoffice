import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { parseSumUpCallback } from '@/lib/sumup-deeplink';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * SumUp-App Callback nach Karten-Zahlung am Tablet.
 *
 * Wird vom SumUp-App-Deep-Link callbackKonsum aufgerufen mit:
 *   ?order={orderId}&register={registerId}&shift={shiftId}
 *   &smp-status=success|failed|cancelled
 *   &smp-tx-code=...&smp-tx-info=...
 *
 * Bei success: pay_pending_order RPC ausführen, dann Redirect zurück ins Terminal.
 * Bei failed/cancelled: kein Status-Update, Redirect mit Error-Flag.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const orderId = url.searchParams.get('order');
  const registerId = url.searchParams.get('register');
  const shiftId = url.searchParams.get('shift');
  const cb = parseSumUpCallback(url);

  if (!orderId) {
    return NextResponse.redirect(new URL('/pos/terminal?sumup=missing-order', req.url));
  }

  if (cb.status !== 'success') {
    const reason = cb.status ?? 'unknown';
    return NextResponse.redirect(
      new URL(`/pos/terminal?sumup=${reason}&order=${orderId}`, req.url),
    );
  }

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL('/login?next=/pos/terminal', req.url));
  }

  const svc = createServiceClient();
  const { data, error } = await svc.rpc('pay_pending_order', {
    p_order_id: orderId,
    p_zahlungsart: 'karte',
    p_register_id: registerId,
    p_shift_id: shiftId,
  });

  if (error || !(data as any)?.ok) {
    const msg = error?.message ?? (data as any)?.error ?? 'rpc-failed';
    return NextResponse.redirect(
      new URL(`/pos/terminal?sumup=success-rpc-failed&order=${orderId}&msg=${encodeURIComponent(msg)}`, req.url),
    );
  }

  if (cb.txCode) {
    await svc.from('customer_orders').update({
      stripe_payment_id: `sumup:${cb.txCode}`,
    }).eq('id', orderId);
  }

  return NextResponse.redirect(
    new URL(`/pos/terminal?sumup=ok&order=${orderId}`, req.url),
  );
}
