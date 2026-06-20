import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/layout/page-header';
import { ReorderNotifyClient } from './client';
import { getReorderNotifyDashboard } from '@/lib/delivery/smart-reorder-notify';

export const dynamic = 'force-dynamic';

export default async function ReorderNotifyPage() {
  const employee = await requireManagerPlus();
  const sb = await createClient();

  const { data: emp } = await sb
    .from('employees')
    .select('id, location_id')
    .eq('id', employee.id)
    .maybeSingle();

  if (!emp?.location_id) redirect('/start');

  const dashboard = await getReorderNotifyDashboard(emp.location_id);

  return (
    <>
      <PageHeader
        title="Smart Reorder Notifications"
        description="Push-Alerts bei kritischem Artikelbestand · Dedup-Schutz · Automatischer 15-Min-Scan"
      />
      <ReorderNotifyClient locationId={emp.location_id} initial={dashboard} />
    </>
  );
}
