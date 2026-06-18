import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { BenchmarkingClient } from './client';
import { getBenchmarkDashboard } from '@/lib/delivery/benchmarking';

export const dynamic = 'force-dynamic';

export default async function BenchmarkingPage() {
  const employee = await requireManagerPlus();
  const sb = await createClient();

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('id', employee.id)
    .maybeSingle();

  if (!emp?.location_id) redirect('/start');

  const dashboard = await getBenchmarkDashboard(emp.location_id).catch(() => null);

  return (
    <BenchmarkingClient
      locationId={emp.location_id}
      initial={dashboard}
    />
  );
}
