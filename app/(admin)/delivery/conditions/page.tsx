import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { ConditionsForm } from './client';

export const dynamic = 'force-dynamic';

export default async function DeliveryConditionsPage() {
  const employee = await requireManagerPlus();
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: emp } = await sb.from('employees').select('tenant_id').eq('id', employee.id).maybeSingle();
  if (!emp?.tenant_id) redirect('/start');

  const { data: tenant } = await svc
    .from('tenants')
    .select('id,liefergebuehr,mindestbestellwert,durchschnittliche_lieferzeit_min')
    .eq('id', emp.tenant_id)
    .single();

  if (!tenant) redirect('/start');

  return (
    <>
      <PageHeader
        title="Lieferkonditionen"
        description="Gebühr, Mindestbestellwert und Lieferzeit — wird den Kunden auf deiner Bestellseite angezeigt."
        backHref="/delivery"
      />
      <ConditionsForm
        tenantId={tenant.id}
        initial={{
          liefergebuehr: (tenant as any).liefergebuehr ?? 2.9,
          mindestbestellwert: (tenant as any).mindestbestellwert ?? 12,
          lieferzeit_min: (tenant as any).durchschnittliche_lieferzeit_min ?? 30,
        }}
      />
    </>
  );
}
