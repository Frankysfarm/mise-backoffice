import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/layout/page-header';
import { OrderRescueClient } from './client';

export const dynamic = 'force-dynamic';

export default async function OrderRescuePage() {
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
        title="Order Rescue Engine"
        description="Gefährdete Bestellungen erkennen und proaktiv retten · Stornierungen verhindern"
      />
      <OrderRescueClient locationId={emp.location_id} />
    </>
  );
}
