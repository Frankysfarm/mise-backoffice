import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/layout/page-header';
import { AiForecastClient } from './client';

export const dynamic = 'force-dynamic';

export default async function AiForecastPage() {
  const employee = await requireManagerPlus();
  const sb = await createClient();

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('id', employee.id)
    .maybeSingle();

  if (!emp?.location_id) redirect('/start');

  return (
    <>
      <PageHeader
        title="KI-Nachfrage-Prognose"
        description="Claude analysiert historische Daten und liefert Nachfrage-Insights"
      />
      <AiForecastClient locationId={emp.location_id} />
    </>
  );
}
