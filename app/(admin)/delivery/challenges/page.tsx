import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/layout/page-header';
import { ChallengesClient } from './client';

export const dynamic = 'force-dynamic';

export default async function ChallengesPage() {
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
        title="Fahrer-Challenges"
        description="Gamifizierte Anreize · Zeitbegrenzte Delivery-Ziele · Automatische Fortschrittsverfolgung"
      />
      <ChallengesClient locationId={emp.tenant_id as string} />
    </>
  );
}
