import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/layout/page-header';
import { getSmartTipDashboard } from '@/lib/delivery/smart-tip-engine';
import { SmartTipEngineClient } from './client';

export const dynamic = 'force-dynamic';

export default async function SmartTipEnginePage() {
  const employee = await requireManagerPlus();
  const sb = await createClient();
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('id', employee.id)
    .maybeSingle();
  if (!emp?.location_id) redirect('/start');

  const dashboard = await getSmartTipDashboard(emp.location_id as string);

  return (
    <>
      <PageHeader
        title="Smart Tip Engine"
        description="Dynamische Trinkgeld-Vorschläge basierend auf Pünktlichkeit, Fahrer-Score und Bestellwert"
      />
      <SmartTipEngineClient locationId={emp.location_id as string} initial={dashboard} />
    </>
  );
}
