import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { DriverFeedbackClient } from './client';
import { getLocationDashboard } from '@/lib/delivery/driver-feedback';

export const dynamic = 'force-dynamic';

export default async function DriverFeedbackPage() {
  const employee = await requireManagerPlus();
  const sb = await createClient();

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('id', employee.id)
    .maybeSingle();

  if (!emp?.location_id) redirect('/start');

  const dashboard = await getLocationDashboard(emp.location_id).catch(() => null);

  return (
    <DriverFeedbackClient
      locationId={emp.location_id}
      initial={dashboard}
    />
  );
}
