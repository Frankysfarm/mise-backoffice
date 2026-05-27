import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { TSESettings } from './client';

export const dynamic = 'force-dynamic';

export default async function TSESettingsPage() {
  const emp = await requireManagerPlus();
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: empRow } = await sb.from('employees').select('tenant_id').eq('id', emp.id).maybeSingle();
  if (!empRow?.tenant_id) redirect('/start');

  const { data: tenant } = await svc.from('tenants')
    .select('fiskaly_api_key, fiskaly_api_secret, fiskaly_organization_id, fiskaly_tss_id, fiskaly_client_id, fiskaly_environment')
    .eq('id', empRow.tenant_id).single();

  return (
    <>
      <PageHeader
        title="TSE · Technische Sicherheitseinrichtung"
        description="Nach KassenSichV verpflichtend. Wir nutzen fiskaly Cloud-TSE — automatische Finanzamt-Meldung & DSFinV-K-Export."
        backHref="/shop/payments"
      />
      <TSESettings
        tenantId={empRow.tenant_id}
        initial={tenant as any}
      />
    </>
  );
}
