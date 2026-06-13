import { createServiceClient } from '@/lib/supabase/server';
import { getStripe, stripeConfigured } from '@/lib/stripe/client';
import { PaidOrderClient } from './client';

export const dynamic = 'force-dynamic';

export default async function OrderPaidPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string; bon?: string }>;
}) {
  const sp = await searchParams;
  const svc = createServiceClient();

  let paid = false;
  let amountTotal: number | null = null;

  if (sp.session_id && stripeConfigured()) {
    const stripe = getStripe()!;
    try {
      const session = await stripe.checkout.sessions.retrieve(sp.session_id);
      paid = session.payment_status === 'paid';
      amountTotal = session.amount_total ? session.amount_total / 100 : null;

      if (paid && session.metadata?.order_id) {
        await svc
          .from('customer_orders')
          .update({ bezahlt: true, stripe_payment_id: session.id })
          .eq('id', session.metadata.order_id);
      }
    } catch {
      // Session nicht ladbar — trotzdem Success-UI anzeigen
    }
  }

  return (
    <PaidOrderClient
      bon={sp.bon ?? null}
      amountTotal={amountTotal}
      paid={paid}
    />
  );
}
