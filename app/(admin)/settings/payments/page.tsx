import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { PaymentMatrix } from './client';

export const dynamic = 'force-dynamic';

export default async function PaymentsPage() {
  const employee = await requireManagerPlus();
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: emp } = await sb
    .from('employees').select('tenant_id').eq('id', employee.id).maybeSingle();
  if (!emp?.tenant_id) redirect('/start');

  const { data: methods } = await svc
    .from('tenant_payment_methods')
    .select('*')
    .eq('tenant_id', emp.tenant_id)
    .order('sort_order');

  const { data: tenant } = await svc
    .from('tenants')
    .select('stripe_connect_charges_enabled')
    .eq('id', emp.tenant_id)
    .single();

  return (
    <>
      <PageHeader
        title="Zahlungsmethoden"
        description="Welche Zahlungsarten sind bei welcher Bestellart aktiv?"
      />
      <PaymentMatrix
        methods={(methods as any[]) ?? []}
        tenantId={emp.tenant_id}
        stripeReady={!!tenant?.stripe_connect_charges_enabled}
      />
    </>
  );
}
