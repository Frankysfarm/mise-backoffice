import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/layout/page-header';
import { FranchiseClient } from './client';

export const dynamic = 'force-dynamic';

export default async function FranchisePage() {
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
        title="Franchise-Leitstelle"
        description="Live-Status aller Standorte · Queue, Touren und Alarme auf einen Blick"
      />
      <FranchiseClient locationId={emp.location_id} />
    </>
  );
}
