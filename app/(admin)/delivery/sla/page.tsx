import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/layout/page-header';
import { SlaClient } from './client';

export const dynamic = 'force-dynamic';

export default async function SlaPage() {
  const employee = await requireManagerPlus();
  const sb = await createClient();

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('id', employee.id)
    .maybeSingle();

  if (!emp?.location_id) redirect('/start');

  return (
    <>
      <PageHeader
        title="SLA-Bericht"
        description="On-Time-Rate, Lieferzeitabweichung und Performance nach Fahrer & Zone"
      />
      <SlaClient locationId={emp.location_id} />
    </>
  );
}
