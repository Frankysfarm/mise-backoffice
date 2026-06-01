import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { PayoutsClient } from './client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Fahrer-Abrechnung · Mise' };

export default async function PayoutsPage() {
  const emp = await requireManagerPlus();
  const sb = await createClient();

  const { data: empT } = await sb
    .from('employees')
    .select('tenant_id, location_id')
    .eq('id', emp.id)
    .maybeSingle();
  if (!empT?.location_id) redirect('/start');

  const { data: locations } = await sb
    .from('locations')
    .select('id, name')
    .eq('tenant_id', empT.tenant_id!)
    .eq('aktiv', true)
    .order('name');

  return (
    <>
      <PageHeader
        title="Fahrer-Abrechnung"
        description="Vergütungskonfiguration, Einzelabrechnungen und Perioden-Freigabe."
      />
      <PayoutsClient
        defaultLocationId={empT.location_id}
        locations={(locations as any[]) ?? []}
      />
    </>
  );
}
