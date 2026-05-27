import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { GiftCardsManager } from './client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Geschenkgutscheine · Mise' };

export default async function GiftCardsPage() {
  const emp = await requireManagerPlus();
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: empRow } = await sb.from('employees').select('tenant_id').eq('id', emp.id).maybeSingle();
  if (!empRow?.tenant_id) redirect('/start');

  const [{ data: cards }, { count: aktivCount }, { data: stats }] = await Promise.all([
    svc.from('gift_cards')
      .select('id, code, initial_value_cents, current_balance_cents, ausgestellt_am, gueltig_bis, status, empfaenger_name, verkauft_an_email, batch_id')
      .eq('tenant_id', empRow.tenant_id)
      .order('ausgestellt_am', { ascending: false })
      .limit(100),
    svc.from('gift_cards').select('id', { count: 'exact', head: true })
      .eq('tenant_id', empRow.tenant_id).eq('status', 'aktiv'),
    svc.from('gift_cards')
      .select('current_balance_cents.sum(), initial_value_cents.sum()')
      .eq('tenant_id', empRow.tenant_id),
  ]);

  return (
    <>
      <PageHeader
        title="Geschenkgutscheine"
        description="Verkaufen, drucken, einlösen. Restguthaben bleibt nach Einlösung erhalten — Gast kann mehrfach einlösen bis 0 €."
        backHref="/pos/setup"
      />
      <GiftCardsManager
        tenantId={empRow.tenant_id}
        initialCards={(cards as any[]) ?? []}
        aktivCount={aktivCount ?? 0}
        outstandingCents={(stats as any)?.[0]?.sum ?? 0}
      />
    </>
  );
}
