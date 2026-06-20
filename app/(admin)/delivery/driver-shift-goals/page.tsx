import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { getDriverShiftGoalConfig } from '@/lib/delivery/driver-shift-goals';
import { DriverShiftGoalsClient } from './client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Fahrer-Schichtziele' };

export default async function DriverShiftGoalsPage() {
  const employee = await requireManagerPlus();
  const sb = await createClient();

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('id', employee.id)
    .maybeSingle();

  const locationId = (emp as { location_id?: string } | null)?.location_id ?? '';
  const config = locationId ? await getDriverShiftGoalConfig(locationId) : null;

  return <DriverShiftGoalsClient initialConfig={config} />;
}
