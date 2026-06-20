import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { ZoneBatchOptimizerClient } from './client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Zone Batch Optimizer' };

export default async function ZoneBatchOptimizerPage() {
  const employee = await requireManagerPlus();
  const sb = await createClient();

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('id', employee.id)
    .maybeSingle();

  if (!emp?.location_id) redirect('/start');

  return <ZoneBatchOptimizerClient locationId={emp.location_id as string} />;
}
