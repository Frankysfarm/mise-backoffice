import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/layout/page-header';
import { CustomerValueScoreClient } from './client';

export const dynamic = 'force-dynamic';

export default async function CustomerValueScorePage() {
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
        title="Kunden-Wert-Score (CVS)"
        description="Aggregierter Score 0–100 aus RFM · Frequenz · Umsatz · Aktualität — Identifiziert Platinum-, Gold-, Silber- und Bronze-Kunden"
        backHref="/delivery"
      />
      <CustomerValueScoreClient locationId={emp.tenant_id as string} />
    </>
  );
}
