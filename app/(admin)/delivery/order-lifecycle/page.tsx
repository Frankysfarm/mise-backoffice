import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { OrderLifecycleClient } from './client';
import { getLifecycleDashboard } from '@/lib/delivery/order-lifecycle';

export const dynamic = 'force-dynamic';

export default async function OrderLifecyclePage() {
  const employee = await requireManagerPlus();
  const sb = await createClient();

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('id', employee.id)
    .maybeSingle();

  if (!emp?.location_id) redirect('/start');

  const dashboard = await getLifecycleDashboard(emp.location_id as string).catch(() => null);

  return (
    <OrderLifecycleClient
      locationId={emp.location_id as string}
      initial={dashboard}
    />
  );
}
