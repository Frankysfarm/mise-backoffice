import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { RestaurantSettings } from './client';

export const dynamic = 'force-dynamic';

export default async function RestaurantSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ stripe?: string; stripe_error?: string }>;
}) {
  const employee = await requireManagerPlus();
  const supabase = await createClient();
  const svc = createServiceClient();

  const { data: empTenant } = await supabase
    .from('employees')
    .select('tenant_id')
    .eq('id', employee.id)
    .maybeSingle();

  if (!empTenant?.tenant_id) redirect('/start');

  const { data: tenant } = await svc
    .from('tenants')
    .select('*')
    .eq('id', empTenant.tenant_id)
    .single();

  if (!tenant) redirect('/start');

  const sp = await searchParams;

  return (
    <>
      <PageHeader
        title="Restaurant-Einstellungen"
        description="Stammdaten, Zahlung und Lieferzone deines Restaurants"
      />
      <RestaurantSettings
        tenant={tenant as any}
        stripeFlash={sp.stripe}
        stripeError={sp.stripe_error}
        stripeConfigured={!!process.env.STRIPE_SECRET_KEY}
      />
    </>
  );
}
