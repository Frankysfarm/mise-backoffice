import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { ZoneForm } from './client';

export const dynamic = 'force-dynamic';

export default async function DeliveryZonePage() {
  const employee = await requireManagerPlus();
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: emp } = await sb.from('employees').select('tenant_id').eq('id', employee.id).maybeSingle();
  if (!emp?.tenant_id) redirect('/start');

  const [{ data: tenant }, { data: locations }] = await Promise.all([
    svc.from('tenants').select('id,lieferradius_km,name').eq('id', emp.tenant_id).single(),
    svc.from('locations').select('id,name,adresse,stadt,plz,lat,lng').eq('tenant_id', emp.tenant_id).eq('aktiv', true),
  ]);

  if (!tenant) redirect('/start');

  return (
    <>
      <PageHeader
        title="Liefergebiet"
        description="Bis wohin liefern deine Fahrer? Radius um deinen Standort."
        backHref="/delivery"
      />
      <ZoneForm
        tenantId={tenant.id}
        initialRadius={(tenant as any).lieferradius_km ?? 8}
        locations={(locations as any[]) ?? []}
      />
    </>
  );
}
