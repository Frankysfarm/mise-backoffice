import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/layout/page-header';
import { ForecastKiClient } from './client';

export const dynamic = 'force-dynamic';

export default async function ForecastKiPage() {
  const employee = await requireManagerPlus().catch(() => redirect('/start'));
  const sb = await createClient();

  const { data: emp } = await sb
    .from('employees')
    .select('tenant_id')
    .eq('id', employee.id)
    .maybeSingle();

  if (!emp?.tenant_id) redirect('/start');
  const locationId = emp.tenant_id;

  return (
    <>
      <PageHeader
        title="Nachfrage-Prognose KI"
        description="Stundengenaue Bestellvorhersage + KI-Empfehlungen für Fahrereinsatz und Peak-Vorbereitung"
      />
      <ForecastKiClient locationId={locationId} />
    </>
  );
}
