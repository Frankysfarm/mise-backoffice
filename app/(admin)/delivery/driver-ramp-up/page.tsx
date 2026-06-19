import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/layout/page-header';
import { DriverRampUpClient } from './client';
import { getRampUpDashboard, computeRampUpForLocation } from '@/lib/delivery/driver-ramp-up';

export const dynamic = 'force-dynamic';

export default async function DriverRampUpPage() {
  const employee = await requireManagerPlus();
  const sb = await createClient();

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('id', employee.id)
    .maybeSingle();

  if (!emp?.location_id) redirect('/start');

  const locationId = emp.location_id as string;

  // Einmal berechnen, damit neue Fahrer sofort sichtbar sind
  await computeRampUpForLocation(locationId).catch(() => null);

  const dashboard = await getRampUpDashboard(locationId).catch(() => null);

  return (
    <>
      <PageHeader
        title="Fahrer Ramp-Up Intelligence"
        description="Neue Fahrer in den ersten 60 Tagen · Score & Tier · Coaching-Flags · Retention-Prognose"
      />
      <DriverRampUpClient locationId={locationId} initial={dashboard} />
    </>
  );
}
