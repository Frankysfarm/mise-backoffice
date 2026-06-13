import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/layout/page-header';
import { SurgePredictionClient } from './client';

export const dynamic = 'force-dynamic';

export default async function SurgePredictionPage() {
  const employee = await requireManagerPlus();
  const sb = await createClient();

  const { data: emp } = await sb
    .from('employees')
    .select('location_id, tenant_id')
    .eq('id', employee.id)
    .maybeSingle();

  if (!emp?.location_id) redirect('/start');

  return (
    <>
      <PageHeader
        title="Surge-Vorhersage & Fahrer-Mobilisierung"
        description="KI-Prognose von Nachfragespitzen 30–60 Min voraus · Automatische Fahrer-Benachrichtigung"
      />
      <SurgePredictionClient locationId={emp.location_id} />
    </>
  );
}
