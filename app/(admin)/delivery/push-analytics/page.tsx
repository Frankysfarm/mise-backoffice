import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createServiceClient } from '@/lib/supabase/server';
import { PushAnalyticsClient } from './client';

export const dynamic = 'force-dynamic';

export default async function PushAnalyticsPage() {
  const employee = await requireManagerPlus();
  const svc      = createServiceClient();

  const { data: emp } = await svc
    .from('employees')
    .select('location_id')
    .eq('id', employee.id)
    .maybeSingle();

  if (!emp?.location_id) redirect('/start');

  return <PushAnalyticsClient locationId={emp.location_id as string} />;
}
