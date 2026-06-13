import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/layout/page-header';
import { ProfitabilityClient } from './client';

export const dynamic = 'force-dynamic';

export default async function ProfitabilityPage() {
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
        title="Profitabilität"
        description="Liefergebühren vs. Fahrer-Kosten · P&amp;L nach Zone &amp; Fahrer · Gebühren-Empfehlungen"
      />
      <ProfitabilityClient locationId={emp.tenant_id as string} />
    </>
  );
}
