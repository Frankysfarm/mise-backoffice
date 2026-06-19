import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { getShiftGoals } from '@/lib/delivery/shift-goals';
import { ShiftGoalsClient } from './client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Schichtziele konfigurieren' };

export default async function ShiftGoalsPage() {
  const employee = await requireManagerPlus();
  const sb = await createClient();

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('id', employee.id)
    .maybeSingle();

  const locationId = emp?.location_id as string | undefined;
  const config = locationId ? await getShiftGoals(locationId) : null;

  return <ShiftGoalsClient locationId={locationId ?? null} initialConfig={config} />;
}
