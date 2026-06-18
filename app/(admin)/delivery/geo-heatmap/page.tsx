import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/layout/page-header';
import { GeoHeatmapClient } from './client';

export const dynamic = 'force-dynamic';

export default async function GeoHeatmapPage() {
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
        title="Geo-Heatmap Pro"
        description="Echtzeit-Liefer-Dichte · Zonen-Auslastung pro Stunde · GeoJSON-Export"
      />
      <GeoHeatmapClient locationId={emp.location_id as string} />
    </>
  );
}
