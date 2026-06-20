import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/layout/page-header';
import { DriverRankingClient } from './client';
import { getWeeklyRankingDashboard } from '@/lib/delivery/driver-ranking';

export const dynamic = 'force-dynamic';

export default async function DriverRankingPage() {
  const employee = await requireManagerPlus();
  const sb = await createClient();

  const { data: emp } = await sb
    .from('employees')
    .select('id, location_id')
    .eq('id', employee.id)
    .maybeSingle();

  if (!emp?.location_id) redirect('/start');

  const dashboard = await getWeeklyRankingDashboard(emp.location_id);

  return (
    <>
      <PageHeader
        title="Wöchentliches Fahrer-Ranking"
        description="Automatisches Ranking · Top-3-Prämien · Verlauf der letzten 8 Wochen"
      />
      <DriverRankingClient
        locationId={emp.location_id}
        employeeId={emp.id}
        initial={dashboard}
      />
    </>
  );
}
