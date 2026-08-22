import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { StationsManager } from './client';

export const dynamic = 'force-dynamic';

export default async function StationsPage() {
  const emp = await requireManagerPlus();
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: empRow } = await sb.from('employees').select('tenant_id,location_id').eq('id', emp.id).maybeSingle();
  if (!empRow?.tenant_id || !empRow.location_id) redirect('/start');

  const [{ data: stations }, { data: categories }, { data: routing }] = await Promise.all([
    svc.from('kitchen_stations').select('*').eq('location_id', empRow.location_id).order('sort_order'),
    svc.from('menu_categories').select('id, name, icon').eq('location_id', empRow.location_id).order('sort_order'),
    svc.from('station_category_routing').select('*'),
  ]);

  return (
    <>
      <PageHeader
        title="Küchen-Stationen"
        description="Route Bestellungen automatisch zur richtigen Station — Pasta in die Küche, Drinks an die Bar."
        backHref="/pos"
      />
      <StationsManager
        tenantId={empRow.tenant_id}
        locationId={empRow.location_id}
        initialStations={(stations as any[]) ?? []}
        categories={(categories as any[]) ?? []}
        initialRouting={(routing as any[]) ?? []}
      />
    </>
  );
}
