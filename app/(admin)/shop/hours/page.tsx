import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { HoursForm, type DayHours } from './client';

export const dynamic = 'force-dynamic';

export default async function ShopHoursPage() {
  const employee = await requireManagerPlus();
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: emp } = await sb.from('employees').select('tenant_id').eq('id', employee.id).maybeSingle();
  if (!emp?.tenant_id) redirect('/start');

  const { data: tenant } = await svc
    .from('tenants')
    .select('id, oeffnungszeiten_json')
    .eq('id', emp.tenant_id)
    .single();

  if (!tenant) redirect('/start');

  const existing = (tenant.oeffnungszeiten_json as DayHours[] | null) ?? null;

  return (
    <>
      <PageHeader
        title="Öffnungszeiten"
        description="Wann kann bestellt werden? Außerhalb dieser Zeiten ist dein Shop geschlossen."
        backHref="/shop"
      />
      <HoursForm tenantId={tenant.id} initial={existing} />
    </>
  );
}
