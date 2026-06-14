import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/layout/page-header';
import { GeoClusteringClient } from './client';

export const dynamic = 'force-dynamic';

export default async function GeoClusteringPage() {
  const employee = await requireManagerPlus();
  const sb = await createClient();

  const { data: emp } = await sb
    .from('employees')
    .select('tenant_id')
    .eq('id', employee.id)
    .maybeSingle();

  if (!emp?.tenant_id) redirect('/start');

  return (
    <>
      <PageHeader
        title="Geo-Clustering"
        description="K-Means Hotspot-Analyse · Demand-Cluster aus Lieferdaten · Optimale Fahrer-Vorpositionierung"
      />
      <GeoClusteringClient locationId={emp.tenant_id} />
    </>
  );
}
