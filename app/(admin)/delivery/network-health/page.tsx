import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/layout/page-header';
import { NetworkHealthClient } from './client';

export const dynamic = 'force-dynamic';

export default async function NetworkHealthPage() {
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
        title="Netzwerk-Gesundheit"
        description="7-Faktoren-Score für den gesamten Lieferbetrieb — Pünktlichkeit, Zufriedenheit, Auslastung, Dispatch, Stornierungen, Kapazität und Profitabilität auf einen Blick."
      />
      <NetworkHealthClient locationId={emp.location_id} />
    </>
  );
}
