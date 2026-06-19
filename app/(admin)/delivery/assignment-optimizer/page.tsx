import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { getSuggestionDashboard } from '@/lib/delivery/assignment-optimizer';
import { AssignmentOptimizerClient } from './client';

export const dynamic = 'force-dynamic';

export default async function AssignmentOptimizerPage() {
  const employee = await requireManagerPlus();
  const sb = await createClient();

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('id', employee.id)
    .maybeSingle();

  if (!emp?.location_id) redirect('/start');

  let dashboard = null;
  try {
    dashboard = await getSuggestionDashboard(emp.location_id as string);
  } catch {
    // graceful fallback
  }

  return (
    <>
      <PageHeader
        title="Zuweisung-Optimizer"
        description="KI-gestützte Echtzeit-Vorschläge: welcher Fahrer welche Bestellung übernehmen sollte — inklusive Rückkehr-Prognose-Integration."
        backHref="/delivery"
      />
      <AssignmentOptimizerClient initialDashboard={dashboard} />
    </>
  );
}
