import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/layout/page-header';
import { DriverDigestClient } from './client';

export const dynamic = 'force-dynamic';

export default async function DriverDigestPage() {
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
        title="Fahrer Tagesabschluss-E-Mail"
        description="Personalisierte Tagesberichte für jeden Fahrer · Leistung, Verdienst, Challenges · täglich 20:00 UTC"
      />
      <DriverDigestClient locationId={emp.tenant_id} />
    </>
  );
}
