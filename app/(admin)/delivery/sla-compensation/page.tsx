import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/layout/page-header';
import { SlaCompensationClient } from './client';

export const dynamic = 'force-dynamic';

export default async function SlaCompensationPage() {
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
        title="SLA Auto-Kompensation"
        description="Automatische Gutschriften bei verspäteten Lieferungen — schützt die Kundenzufriedenheit"
      />
      <SlaCompensationClient locationId={emp.location_id as string} />
    </>
  );
}
