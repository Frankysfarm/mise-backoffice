import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { RegistersManager } from './client';

export const dynamic = 'force-dynamic';

export default async function RegistersPage() {
  const emp = await requireManagerPlus();
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: empRow } = await sb.from('employees').select('tenant_id,location_id').eq('id', emp.id).maybeSingle();
  if (!empRow?.tenant_id || !empRow.location_id) redirect('/start');

  const { data: registers } = await svc.from('pos_registers')
    .select('*, terminals:pos_terminals(id, name, device_token, pairing_code, gepaart_am, letzter_kontakt, aktiv, sumup_reader_id)')
    .eq('location_id', empRow.location_id).order('created_at');

  return (
    <>
      <PageHeader
        title="Kassen / Terminals"
        description="Wieviele Kassen hast du? Jede bekommt ihren eigenen Code zum Pairing mit dem Tablet."
        backHref="/pos"
      />
      <RegistersManager
        tenantId={empRow.tenant_id}
        locationId={empRow.location_id}
        initialRegisters={(registers as any[]) ?? []}
      />
    </>
  );
}
