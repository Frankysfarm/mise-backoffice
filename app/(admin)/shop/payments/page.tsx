import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { PaymentMatrix } from '@/app/(admin)/settings/payments/client';

export const dynamic = 'force-dynamic';

export default async function ShopPaymentsPage() {
  const employee = await requireManagerPlus();
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: emp } = await sb.from('employees').select('tenant_id').eq('id', employee.id).maybeSingle();
  if (!emp?.tenant_id) redirect('/start');

  const [{ data: methods }, { data: tenant }] = await Promise.all([
    svc.from('tenant_payment_methods').select('*').eq('tenant_id', emp.tenant_id).order('sort_order'),
    svc.from('tenants').select('stripe_connect_charges_enabled').eq('id', emp.tenant_id).single(),
  ]);

  return (
    <>
      <PageHeader
        title="Zahlungsarten"
        description="Bar · Karte · Online — welche Methode ist bei welcher Bestellart aktiv?"
        backHref="/shop"
      />

      {/* Payment-Provider-Karten */}
      <div className="grid gap-3 md:grid-cols-2 mb-6">
        <a href="/settings/stripe" className="group rounded-2xl border bg-card p-4 hover:shadow-soft transition">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-violet-600 text-white grid place-items-center font-black">
              S
            </div>
            <div className="flex-1">
              <div className="font-display font-bold">Stripe Connect</div>
              <div className="text-xs text-muted-foreground">Apple Pay · Google Pay · Kreditkarte</div>
            </div>
            <div className={`text-xs font-bold ${tenant?.stripe_connect_charges_enabled ? 'text-matcha-700' : 'text-amber-700'}`}>
              {tenant?.stripe_connect_charges_enabled ? '✓ aktiv' : 'einrichten'}
            </div>
          </div>
        </a>
        <a href="/settings/sumup" className="group rounded-2xl border bg-card p-4 hover:shadow-soft transition">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-gray-900 text-white grid place-items-center font-black text-sm">
              Sum
            </div>
            <div className="flex-1">
              <div className="font-display font-bold">SumUp Card Reader</div>
              <div className="text-xs text-muted-foreground">Kartenzahlung am POS via Bluetooth-Reader</div>
            </div>
            <div className="text-xs font-bold text-amber-700">einrichten</div>
          </div>
        </a>
      </div>

      <PaymentMatrix
        methods={(methods as any[]) ?? []}
        tenantId={emp.tenant_id}
        stripeReady={!!tenant?.stripe_connect_charges_enabled}
      />
    </>
  );
}
