import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { StripeSelfServiceClient } from './client';

export const dynamic = 'force-dynamic';

export default async function StripeSettingsPage() {
  const employee = await requireRole(['admin']);
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: emp } = await sb
    .from('employees')
    .select('tenant_id')
    .eq('id', employee.id)
    .maybeSingle();
  if (!emp?.tenant_id) redirect('/start');

  const { data: tenant } = await svc
    .from('tenants')
    .select(
      'id, name, stripe_publishable_key, stripe_account_email, stripe_account_country, stripe_mode, stripe_connected_at, stripe_connect_charges_enabled, stripe_connect_payouts_enabled, stripe_connect_details_submitted',
    )
    .eq('id', emp.tenant_id)
    .single();

  if (!tenant) redirect('/start');

  return (
    <>
      <PageHeader
        title="Stripe verbinden"
        description="In 5 Minuten startklar — kassiere Apple Pay, Google Pay & Karte direkt auf deine IBAN."
        backHref="/shop/payments"
      />
      <StripeSelfServiceClient
        tenantName={tenant.name}
        publishableKey={tenant.stripe_publishable_key}
        accountEmail={tenant.stripe_account_email}
        country={tenant.stripe_account_country}
        mode={tenant.stripe_mode}
        connectedAt={tenant.stripe_connected_at}
        chargesEnabled={tenant.stripe_connect_charges_enabled ?? false}
        payoutsEnabled={tenant.stripe_connect_payouts_enabled ?? false}
        detailsSubmitted={tenant.stripe_connect_details_submitted ?? false}
      />
    </>
  );
}
