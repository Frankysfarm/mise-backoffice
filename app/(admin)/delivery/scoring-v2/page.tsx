import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/layout/page-header';
import { ScoringV2Client } from './client';

export const dynamic = 'force-dynamic';

export default async function ScoringV2Page() {
  const employee = await requireManagerPlus();
  const sb = await createClient();

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('id', employee.id)
    .maybeSingle();

  if (!emp?.location_id) redirect('/start');

  return (
    <>
      <PageHeader
        title="Dispatch ML-Scoring V2"
        description="12-Faktoren Fahrer-Scoring mit Wetter, Geschwindigkeit und historischen Zone×Fahrzeug-Erfolgsraten"
      />
      <ScoringV2Client locationId={(emp as { location_id: string }).location_id} />
    </>
  );
}
