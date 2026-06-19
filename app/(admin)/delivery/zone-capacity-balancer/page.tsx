import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/layout/page-header';
import { ZoneCapacityBalancerClient } from './client';

export const dynamic = 'force-dynamic';

export default async function ZoneCapacityBalancerPage() {
  const employee = await requireManagerPlus();
  const sb = await createClient();

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('id', employee.id)
    .maybeSingle();

  if (!emp?.location_id) redirect('/start');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Zonen-Kapazitäts-Balancer"
        description="Echtzeit-Übersicht: Bestellungen vs. Fahrer je Zone · Rebalancing-Empfehlungen"
      />
      <ZoneCapacityBalancerClient locationId={emp.location_id} />
    </div>
  );
}
