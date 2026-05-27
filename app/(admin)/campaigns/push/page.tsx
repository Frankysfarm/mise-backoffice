import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { PushComposer } from './client';

export const dynamic = 'force-dynamic';

export default async function PushCampaignPage() {
  const employee = await requireManagerPlus();
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: emp } = await sb.from('employees').select('tenant_id').eq('id', employee.id).maybeSingle();
  if (!emp?.tenant_id) redirect('/start');

  const [{ count: totalCount }, { data: recent }] = await Promise.all([
    svc.from('customer_push_subscriptions').select('id', { count: 'exact', head: true })
      .eq('tenant_id', emp.tenant_id).eq('marketing_opt_in', true),
    svc.from('customer_push_outbox')
      .select('id, title, body, created_at, sent_at, error')
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  return (
    <>
      <PageHeader
        title="Angebots-Push senden"
        description="Direkt aufs Handy deiner Kunden — wer dich einmal abonniert hat, bekommt deine Angebote."
        backHref="/campaigns"
      />
      <PushComposer
        tenantId={emp.tenant_id}
        totalSubscribers={totalCount ?? 0}
        recentCampaigns={(recent as any[]) ?? []}
      />
    </>
  );
}
