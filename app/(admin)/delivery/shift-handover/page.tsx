import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { ShiftHandoverClient } from './client';
import { getHandoverDashboard } from '@/lib/delivery/shift-handover';

export const dynamic = 'force-dynamic';

export default async function ShiftHandoverPage() {
  const employee = await requireManagerPlus();
  const sb = await createClient();

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('id', employee.id)
    .maybeSingle();

  if (!emp?.location_id) redirect('/start');

  const dashboard = await getHandoverDashboard(emp.location_id).catch(() => null);

  return (
    <ShiftHandoverClient
      locationId={emp.location_id}
      employeeId={employee.id}
      initial={dashboard}
    />
  );
}
