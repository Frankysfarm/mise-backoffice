import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/layout/page-header';
import { IncentiveV2Client } from './client';
import { getIncentiveV2Dashboard } from '@/lib/delivery/driver-incentive-v2';

export const dynamic = 'force-dynamic';

export default async function IncentiveV2Page() {
  const employee = await requireManagerPlus();
  const sb = await createClient();

  const { data: emp } = await sb
    .from('employees')
    .select('id, location_id')
    .eq('id', employee.id)
    .maybeSingle();

  if (!emp?.location_id) redirect('/start');

  const dashboard = await getIncentiveV2Dashboard(emp.location_id);

  return (
    <>
      <PageHeader
        title="Incentive Engine V2"
        description="Echtzeit-Bonuspunkte · Peak-Hour-Multiplikator · Treue-Streak · Leaderboard"
      />
      <IncentiveV2Client locationId={emp.location_id} initial={dashboard} />
    </>
  );
}
