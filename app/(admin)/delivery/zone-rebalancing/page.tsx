import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { ZoneRebalancingClient } from './client';
import { getDashboard } from '@/lib/delivery/zone-rebalancing';

export const dynamic = 'force-dynamic';

export default async function ZoneRebalancingPage() {
  const employee = await requireManagerPlus();
  const sb = await createClient();

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('id', employee.id)
    .maybeSingle();

  if (!emp?.location_id) redirect('/start');

  const dashboard = await getDashboard(emp.location_id).catch(() => null);

  return (
    <ZoneRebalancingClient
      locationId={emp.location_id}
      initial={dashboard}
    />
  );
}
