import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { TablesManager } from './client';

export const dynamic = 'force-dynamic';

export default async function TablesPage() {
  const emp = await requireManagerPlus();
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: empRow } = await sb.from('employees').select('tenant_id,location_id').eq('id', emp.id).maybeSingle();
  if (!empRow?.tenant_id || !empRow.location_id) redirect('/start');

  const [{ data: tables }, { data: tenant }] = await Promise.all([
    svc.from('restaurant_tables').select('*')
      .eq('location_id', empRow.location_id)
      .order('sort_order'),
    svc.from('tenants').select('slug').eq('id', empRow.tenant_id).single(),
  ]);

  return (
    <>
      <PageHeader
        title="Tische"
        description="Jeder Tisch bekommt einen eigenen QR-Code — Gäste scannen, bestellen, zahlen."
        backHref="/pos"
      />
      <TablesManager
        tenantId={empRow.tenant_id}
        locationId={empRow.location_id}
        initialTables={(tables as any[]) ?? []}
        slug={tenant?.slug ?? ''}
      />
    </>
  );
}
