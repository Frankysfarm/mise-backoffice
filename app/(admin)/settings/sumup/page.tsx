import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { SumUpSettings } from './client';

export const dynamic = 'force-dynamic';

export default async function SumUpSettingsPage() {
  const emp = await requireManagerPlus();
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: empRow } = await sb.from('employees').select('tenant_id').eq('id', emp.id).maybeSingle();
  if (!empRow?.tenant_id) redirect('/start');

  const { data: tenant } = await svc
    .from('tenants')
    .select('id, sumup_api_key, sumup_merchant_code, sumup_verbunden_am')
    .eq('id', empRow.tenant_id).single();

  return (
    <>
      <PageHeader
        title="SumUp Schnittstelle"
        description="Verbinde dein SumUp-Konto — Karten-Zahlung im POS läuft dann direkt über SumUp Card Reader."
        backHref="/shop/payments"
      />
      <SumUpSettings
        tenantId={empRow.tenant_id}
        initialApiKey={(tenant as any)?.sumup_api_key ?? ''}
        initialMerchantCode={(tenant as any)?.sumup_merchant_code ?? ''}
        verbundenAm={(tenant as any)?.sumup_verbunden_am ?? null}
      />
    </>
  );
}
