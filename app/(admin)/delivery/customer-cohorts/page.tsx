import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/layout/page-header';
import { CustomerCohortsClient } from './client';

export const dynamic = 'force-dynamic';

export default async function CustomerCohortsPage() {
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
        title="Kunden-Kohortenanalyse (LTV)"
        description="Retention-Kurven · Revenue pro Akquisitions-Kohorte · Lifetime-Value-Prognose — Welche Monate bringen die treuesten Kunden?"
        backHref="/delivery"
      />
      <CustomerCohortsClient locationId={emp.tenant_id as string} />
    </>
  );
}
