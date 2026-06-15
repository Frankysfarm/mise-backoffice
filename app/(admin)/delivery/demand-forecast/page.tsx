import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/layout/page-header';
import DemandForecastClient from './client';

export const dynamic = 'force-dynamic';

export default async function DemandForecastPage() {
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
        title="Smart Demand Forecasting"
        description="Stündliche Bestellprognose · Forecast vs. Ist-Vergleich · Genauigkeits-Kalibrierung · 7-Tage-Wochenraster"
      />
      <DemandForecastClient locationId={emp.location_id as string} />
    </>
  );
}
