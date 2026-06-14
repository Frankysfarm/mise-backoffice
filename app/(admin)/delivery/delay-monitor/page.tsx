import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/layout/page-header';
import { DelayMonitorClient } from './client';

export const dynamic = 'force-dynamic';

export default async function DelayMonitorPage() {
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
        title="Verzögerungs-Monitor"
        description="Verspätete Bestellungen, Eskalationsstatus und ausgestellte Kompensations-Gutscheine"
      />
      <DelayMonitorClient locationId={emp.location_id} />
    </>
  );
}
