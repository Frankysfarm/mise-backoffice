import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { PriceListsManager } from './client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Preislisten · Mise' };

export default async function PriceListsPage() {
  const emp = await requireManagerPlus();
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: empRow } = await sb.from('employees').select('tenant_id, location_id').eq('id', emp.id).maybeSingle();
  if (!empRow?.tenant_id || !empRow.location_id) redirect('/start');

  const [{ data: lists }, { data: profiles }, { count: itemsCount }] = await Promise.all([
    svc.from('price_lists')
      .select('*, items_count:price_list_items(count)')
      .eq('tenant_id', empRow.tenant_id)
      .order('prioritaet', { ascending: false }),
    svc.from('order_profiles').select('id, name, type').eq('tenant_id', empRow.tenant_id).eq('aktiv', true).order('sort_order'),
    svc.from('menu_items').select('id', { count: 'exact', head: true }).eq('location_id', empRow.location_id).eq('verfuegbar', true),
  ]);

  return (
    <>
      <PageHeader
        title="Preislisten"
        description="Mehrere Preislisten — Standard, Happy Hour, Lunch-Menu, Wochenend-Aufschlag. Mit Zeitsteuerung automatisch aktiv."
        backHref="/pos/setup"
      />
      <PriceListsManager
        tenantId={empRow.tenant_id}
        locationId={empRow.location_id}
        initialLists={(lists as any[]) ?? []}
        availableProfiles={(profiles as any[]) ?? []}
        totalItemsCount={itemsCount ?? 0}
      />
    </>
  );
}
