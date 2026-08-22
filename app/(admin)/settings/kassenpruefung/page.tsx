import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { KassenPruefungClient } from './client';

export const dynamic = 'force-dynamic';

export default async function KassenPruefungPage() {
  const emp = await requireManagerPlus();
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: empRow } = await sb.from('employees').select('tenant_id').eq('id', emp.id).maybeSingle();
  if (!empRow?.tenant_id) redirect('/start');

  const { data: tokens } = await svc.from('kassenpruefung_tokens')
    .select('*').eq('tenant_id', empRow.tenant_id)
    .order('created_at', { ascending: false }).limit(10);

  return (
    <>
      <PageHeader
        title="Kassen-Nachschau"
        description="Gib Finanzbeamten temporären Read-Only-Zugriff zu deinen Daten (§ 146b AO)."
        backHref="/settings/legal"
      />
      <KassenPruefungClient
        tenantId={empRow.tenant_id}
        employeeId={emp.id}
        initialTokens={(tokens as any[]) ?? []}
      />
    </>
  );
}
