import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/layout/page-header';
import { CommsLogClient } from './client';

export const dynamic = 'force-dynamic';

export default async function CommsLogPage() {
  const employee = await requireManagerPlus();
  const sb = await createClient();

  const { data: emp } = await sb
    .from('employees')
    .select('location_id, tenant_id, name')
    .eq('id', employee.id)
    .maybeSingle();

  if (!emp?.location_id) redirect('/start');

  return (
    <>
      <PageHeader
        title="Kommunikations-Log"
        description="Alle Push-, Broadcast- und System-Nachrichten zwischen Dispatch und Fahrern"
      />
      <CommsLogClient
        locationId={emp.location_id}
        dispatcherName={(emp.name as string | null) ?? undefined}
      />
    </>
  );
}
