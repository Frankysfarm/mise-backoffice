import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/layout/page-header';
import { ZoneAffinityClient } from './client';

export const dynamic = 'force-dynamic';

export default async function ZoneAffinityPage() {
  const employee = await requireManagerPlus();
  const sb = await createClient();

  const { data: emp } = await sb
    .from('employees')
    .select('location_id, tenant_id')
    .eq('id', employee.id)
    .maybeSingle();

  if (!emp?.location_id) redirect('/start');

  return (
    <>
      <PageHeader
        title="Zonen-Affinität Fahrer"
        description="Historische Fahrerkenntnisse pro Lieferzone · Affinitäts-Score beeinflusst automatische Fahrerzuweisung"
      />
      <ZoneAffinityClient locationId={emp.location_id} />
    </>
  );
}
