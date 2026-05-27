import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { FloorPlanEditor } from './client';

export const dynamic = 'force-dynamic';

export default async function TableLayoutPage() {
  const emp = await requireManagerPlus();
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: empRow } = await sb.from('employees').select('tenant_id,location_id').eq('id', emp.id).maybeSingle();
  if (!empRow?.tenant_id || !empRow.location_id) redirect('/start');

  const { data: tables } = await svc.from('restaurant_tables')
    .select('*').eq('location_id', empRow.location_id).eq('aktiv', true).order('sort_order');

  return (
    <>
      <PageHeader
        title="Tisch-Layout"
        description="Platziere deine Tische wie im Restaurant — drag & drop. Später klickst du beim Kassieren direkt auf den Tisch."
        backHref="/pos/tables"
      />
      <FloorPlanEditor
        tenantId={empRow.tenant_id}
        locationId={empRow.location_id}
        initialTables={(tables as any[]) ?? []}
      />
    </>
  );
}
