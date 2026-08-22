import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { TrainingModeSettings } from './client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Schulungsmodus · Mise' };

export default async function TrainingModePage() {
  const emp = await requireManagerPlus();
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: empRow } = await sb.from('employees').select('tenant_id').eq('id', emp.id).maybeSingle();
  if (!empRow?.tenant_id) redirect('/start');

  const { data: tenant } = await svc
    .from('tenants')
    .select('id, name, schulungsmodus_aktiv, schulungsmodus_aktiviert_am')
    .eq('id', empRow.tenant_id)
    .single();
  if (!tenant) redirect('/start');

  const { count: trainingOrders } = await svc
    .from('customer_orders')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenant.id)
    .eq('is_training', true);

  return (
    <>
      <PageHeader
        title="Schulungsmodus"
        description="Übe mit deinem Team ohne dass echte Bons gebucht werden — ideal für Onboarding neuer Mitarbeiter."
        backHref="/pos/setup"
      />
      <TrainingModeSettings
        tenantId={tenant.id}
        tenantName={tenant.name}
        active={tenant.schulungsmodus_aktiv}
        activatedAt={tenant.schulungsmodus_aktiviert_am}
        trainingOrderCount={trainingOrders ?? 0}
      />
    </>
  );
}
