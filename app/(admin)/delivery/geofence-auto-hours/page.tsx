import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/layout/page-header';
import { getAutoHoursDashboard } from '@/lib/delivery/geofence-auto-hours';
import { GeofenceAutoHoursClient } from './client';

export const dynamic = 'force-dynamic';

export default async function GeofenceAutoHoursPage() {
  const employee = await requireManagerPlus();
  const sb = await createClient();
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('id', employee.id)
    .maybeSingle();
  if (!emp?.location_id) redirect('/start');

  const dashboard = await getAutoHoursDashboard(emp.location_id as string);

  return (
    <>
      <PageHeader
        title="Geofence Auto-Öffnung"
        description="Lieferdienst öffnet und schließt automatisch basierend auf Fahrer-Verfügbarkeit"
      />
      <GeofenceAutoHoursClient locationId={emp.location_id as string} initial={dashboard} />
    </>
  );
}
