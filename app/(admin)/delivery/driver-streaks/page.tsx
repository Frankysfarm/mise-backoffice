import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/layout/page-header';
import { DriverStreaksClient } from './client';

export const dynamic = 'force-dynamic';

export default async function DriverStreaksPage() {
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
        title="Streak-Tracking V2"
        description="Aufeinanderfolgende pünktliche Lieferungen — Multiplikator-Boni bei Meilensteinen 5 / 10 / 20 / 50"
        backHref="/delivery"
      />
      <DriverStreaksClient locationId={emp.tenant_id as string} />
    </>
  );
}
