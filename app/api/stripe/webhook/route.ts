import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getStripe, stripeConfigured } from '@/lib/stripe/client';
import type Stripe from 'stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!stripeConfigured()) return NextResponse.json({ ok: false, reason: 'not configured' }, { status: 503 });

  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!whSecret) return NextResponse.json({ error: 'STRIPE_WEBHOOK_SECRET fehlt' }, { status: 500 });

  const stripe = getStripe()!;
  const sig = req.headers.get('stripe-signature');
  if (!sig) return NextResponse.json({ error: 'Missing signature' }, { status: 400 });

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, whSecret);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Invalid' }, { status: 400 });
  }

  const svc = createServiceClient();

  switch (event.type) {
    case 'account.updated': {
      const acc = event.data.object as Stripe.Account;
      await svc
        .from('tenants')
        .update({
          stripe_connect_charges_enabled: !!acc.charges_enabled,
          stripe_connect_payouts_enabled: !!acc.payouts_enabled,
          stripe_connect_details_submitted: !!acc.details_submitted,
        })
        .eq('stripe_connect_account_id', acc.id);
      break;
    }
    case 'checkout.session.completed':
    case 'payment_intent.succeeded': {
      const obj = event.data.object as any;
      const orderId = obj.metadata?.order_id ?? null;
      if (orderId) {
        await svc
          .from('customer_orders')
          .update({
            bezahlt: true,
            stripe_payment_id: obj.id,
          })
          .eq('id', orderId);
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
