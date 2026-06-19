import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { RestockEngineClient } from './client';
import { getDashboard, seedMaterials } from '@/lib/delivery/restock-engine';

export const dynamic = 'force-dynamic';

export default async function RestockEnginePage() {
  const employee = await requireManagerPlus();
  const sb = await createClient();

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('id', employee.id)
    .maybeSingle();

  if (!emp?.location_id) redirect('/start');

  const locationId = emp.location_id as string;

  // Default-Materialien anlegen falls noch keine vorhanden
  await seedMaterials(locationId).catch(() => null);

  const dashboard = await getDashboard(locationId).catch(() => null);

  return (
    <RestockEngineClient
      locationId={locationId}
      initial={dashboard}
    />
  );
}
