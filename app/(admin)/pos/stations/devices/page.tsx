import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { DevicesManager } from './client';

export const dynamic = 'force-dynamic';

export default async function DevicesPage() {
  const emp = await requireManagerPlus();
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: empRow } = await sb.from('employees').select('tenant_id,location_id').eq('id', emp.id).maybeSingle();
  if (!empRow?.tenant_id) redirect('/start');

  const [{ data: devices }, { data: stations }] = await Promise.all([
    svc.from('kitchen_display_devices').select('*, station:kitchen_stations(name, icon, farbe)')
      .eq('tenant_id', empRow.tenant_id).not('gepaart_am', 'is', null).order('created_at', { ascending: false }),
    svc.from('kitchen_stations').select('id, name').eq('tenant_id', empRow.tenant_id).eq('aktiv', true),
  ]);

  return (
    <>
      <PageHeader
        title="Küchen-Displays verbinden"
        description="Gib den 6-stelligen Code ein, der auf dem Küchen-Tablet angezeigt wird."
        backHref="/pos/stations"
      />
      <DevicesManager
        initialDevices={(devices as any[]) ?? []}
        stations={(stations as any[]) ?? []}
      />
    </>
  );
}
