import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/layout/page-header';
import { ShiftCalendarClient } from './client';

export const dynamic = 'force-dynamic';

export default async function ShiftCalendarPage() {
  const employee = await requireManagerPlus();
  const sb = await createClient();

  const { data: emp } = await sb
    .from('employees')
    .select('tenant_id')
    .eq('id', employee.id)
    .maybeSingle();

  if (!emp?.tenant_id) redirect('/start');

  return (
    <>
      <PageHeader
        title="Schicht-Kalender"
        description="Wochenübersicht aller Fahrer-Schichten · Coverage-Status pro Stunde · Schichten planen"
      />
      <ShiftCalendarClient locationId={emp.tenant_id as string} />
    </>
  );
}
