import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { QualityScoreClient } from './client';
import { getQualityDashboard } from '@/lib/delivery/quality-score';

export const dynamic = 'force-dynamic';

export default async function QualityScorePage() {
  const employee = await requireManagerPlus();
  const sb = await createClient();

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('id', employee.id)
    .maybeSingle();

  if (!emp?.location_id) redirect('/start');

  const dashboard = await getQualityDashboard(emp.location_id).catch(() => null);

  return (
    <QualityScoreClient
      locationId={emp.location_id}
      initial={dashboard}
    />
  );
}
