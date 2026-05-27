import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Check, ArrowRight, MapPin } from 'lucide-react';
import { createServiceClient } from '@/lib/supabase/server';
import { getStripe, stripeConfigured } from '@/lib/stripe/client';

export const dynamic = 'force-dynamic';

export default async function OrderPaidPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string; bon?: string }>;
}) {
  const sp = await searchParams;
  const svc = createServiceClient();

  // Stripe-Session verifizieren, wenn verfügbar
  let paid = false;
  let amountTotal: number | null = null;

  if (sp.session_id && stripeConfigured()) {
    const stripe = getStripe()!;
    try {
      const session = await stripe.checkout.sessions.retrieve(sp.session_id);
      paid = session.payment_status === 'paid';
      amountTotal = session.amount_total ? session.amount_total / 100 : null;

      // Order-Status aktualisieren, falls Webhook noch nicht durch ist
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

  const trackUrl = sp.bon ? `/track/${sp.bon}` : '/';

  return (
    <div className="min-h-screen bg-matcha-900 text-white flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="h-20 w-20 mx-auto rounded-full bg-accent text-matcha-900 flex items-center justify-center mb-6 shadow-strong">
          <Check size={36} strokeWidth={3} />
        </div>

        <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight leading-tight">
          {paid ? 'Bezahlt!' : 'Bestellt!'}
        </h1>
        <p className="mt-4 text-matcha-100 text-lg">
          {paid
            ? `Danke — ${amountTotal?.toFixed(2).replace('.', ',') ?? ''} € wurden verbucht.`
            : 'Deine Bestellung ist eingegangen.'}
        </p>

        {sp.bon && (
          <div className="mt-6 font-mono text-xs text-matcha-300 tracking-widest">
            #{sp.bon.replace(/^FF-/, '')}
          </div>
        )}

        <div className="mt-10 space-y-3">
          <Link
            href={trackUrl}
            className="flex items-center justify-center gap-2 rounded-xl bg-accent text-matcha-900 py-4 font-display font-bold text-lg hover:bg-accent/90 active:scale-[0.98] transition"
          >
            <MapPin size={18} />
            Live verfolgen
            <ArrowRight size={18} />
          </Link>
          <div className="text-xs text-matcha-300 pt-2">
            Wir schicken dir eine Bestätigung per E-Mail, falls du eine hinterlegt hast.
          </div>
        </div>
      </div>
    </div>
  );
}
