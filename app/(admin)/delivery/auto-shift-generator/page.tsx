import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/layout/page-header';
import { AutoShiftGeneratorClient } from './client';

export const dynamic = 'force-dynamic';

export default async function AutoShiftGeneratorPage() {
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
        title="Auto-Schicht-Generator"
        description="Kapazitätslücken → konkrete Schichtvorschläge · Fahrerzuweisung nach Zuverlässigkeit · Ein-Klick-Übertrag in Schichtplan"
      />
      <AutoShiftGeneratorClient locationId={emp.location_id} />
    </>
  );
}
