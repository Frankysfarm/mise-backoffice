import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { NewCampaign } from './client';

export const dynamic = 'force-dynamic';

export default async function NewCampaignPage() {
  const emp = await requireManagerPlus();
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: empT } = await sb.from('employees').select('tenant_id').eq('id', emp.id).maybeSingle();
  if (!empT?.tenant_id) redirect('/start');

  const { data: vouchers } = await svc
    .from('vouchers')
    .select('id,code,typ,wert,beschreibung')
    .eq('tenant_id', empT.tenant_id)
    .eq('aktiv', true);

  const { data: audienceAll } = await svc.rpc('campaign_audience', { p_tenant_id: empT.tenant_id, p_audience: 'all_customers' });
  const { data: audienceLast30 } = await svc.rpc('campaign_audience', { p_tenant_id: empT.tenant_id, p_audience: 'last_30d' });
  const { data: audienceVoucher } = await svc.rpc('campaign_audience', { p_tenant_id: empT.tenant_id, p_audience: 'voucher_unused' });

  return (
    <>
      <PageHeader title="Neue Kampagne" backHref="/campaigns" description="Empfänger wählen, Betreff und Inhalt schreiben, versenden." />
      <NewCampaign
        vouchers={(vouchers as any[]) ?? []}
        audienceCounts={{
          all_customers: (audienceAll as any[])?.length ?? 0,
          last_30d: (audienceLast30 as any[])?.length ?? 0,
          voucher_unused: (audienceVoucher as any[])?.length ?? 0,
        }}
      />
    </>
  );
}
