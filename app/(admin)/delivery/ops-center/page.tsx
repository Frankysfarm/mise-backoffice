import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/layout/page-header';
import { OpsCenterClient } from './client';

export const dynamic = 'force-dynamic';

export default async function OpsCenterPage() {
  const employee = await requireManagerPlus();
  const sb = await createClient();

  const { data: emp } = await sb
    .from('employees')
    .select('tenant_id')
    .eq('id', employee.id)
    .maybeSingle();

  if (!emp?.tenant_id) redirect('/start');

  // Ermittle location_id (tenant_id == location_id in diesem System)
  const locationId = emp.tenant_id;

  return (
    <>
      <PageHeader
        title="Ops-Cockpit"
        description="Echtzeit-Übersicht aller Lieferbetrieb-KPIs · Aktualisierung alle 30 Sekunden"
      />
      <OpsCenterClient locationId={locationId} />
    </>
  );
}
