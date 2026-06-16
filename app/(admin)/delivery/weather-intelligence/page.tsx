import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/layout/page-header';
import WeatherIntelligenceClient from './client';

export const dynamic = 'force-dynamic';

export default async function WeatherIntelligencePage() {
  const employee = await requireManagerPlus().catch(() => redirect('/start'));
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
        title="Wetter-Intelligenz"
        description="Echtzeit-Wetterbedingungen · Schwierigkeits-Score · ETA-Faktor · Nachfrage-Prognose · 24h-Verlauf"
      />
      <WeatherIntelligenceClient locationId={emp.location_id as string} />
    </>
  );
}
