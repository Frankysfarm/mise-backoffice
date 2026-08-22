import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { OrderProfilesManager } from './client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Bestell-Profile · Mise' };

export default async function OrderProfilesPage() {
  const emp = await requireManagerPlus();
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: empRow } = await sb.from('employees').select('tenant_id, location_id').eq('id', emp.id).maybeSingle();
  if (!empRow?.tenant_id || !empRow.location_id) redirect('/start');

  const { data: profiles } = await svc.from('order_profiles')
    .select('*')
    .eq('tenant_id', empRow.tenant_id)
    .order('sort_order');

  return (
    <>
      <PageHeader
        title="Bestell-Profile"
        description="Service-Typen wie Dine-in, Takeaway, Delivery, Happy-Hour als eigene Profile mit eigenen Preisen, Service-Charges und Steuersätzen."
        backHref="/pos/setup"
      />
      <OrderProfilesManager
        tenantId={empRow.tenant_id}
        locationId={empRow.location_id}
        initialProfiles={(profiles as any[]) ?? []}
      />
    </>
  );
}
