import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { UpsellsClient } from './client';

export const dynamic = 'force-dynamic';

export default async function UpsellsPage() {
  const emp = await requireManagerPlus();
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: empTenant } = await sb
    .from('employees')
    .select('tenant_id')
    .eq('id', emp.id)
    .maybeSingle();
  if (!empTenant?.tenant_id) redirect('/start');

  const { data: tenant } = await svc
    .from('tenants')
    .select('id, name')
    .eq('id', empTenant.tenant_id)
    .single();
  if (!tenant) redirect('/start');

  const { data: locations } = await svc
    .from('locations')
    .select('id')
    .eq('tenant_id', tenant.id)
    .eq('aktiv', true);
  const locIds = (locations ?? []).map((l) => l.id);

  const { data: items } = await svc
    .from('menu_items')
    .select('id, name, beschreibung, preis, bild_url, beliebt, kategorie:menu_categories(name)')
    .in('location_id', locIds.length > 0 ? locIds : [''])
    .eq('verfuegbar', true)
    .order('sort_order');

  const { data: upsells } = await svc
    .from('tenant_upsells')
    .select('id, menu_item_id, rabatt_prozent, aktiv, sort_order, label_override')
    .eq('tenant_id', tenant.id)
    .order('sort_order');

  return (
    <>
      <PageHeader
        title="Upsells & Cross-Sells"
        description="Wähle Items die deinen Kunden vor dem Checkout angeboten werden. Optional mit Rabatt — wirkt am stärksten bei Getränken, Desserts oder Klassikern."
        backHref="/menu"
      />
      <UpsellsClient
        tenantId={tenant.id}
        items={(items ?? []) as ItemWithCat[]}
        initialUpsells={upsells ?? []}
      />
    </>
  );
}

type ItemWithCat = {
  id: string;
  name: string;
  beschreibung: string | null;
  preis: number;
  bild_url: string | null;
  beliebt: boolean | null;
  kategorie: { name: string } | { name: string }[] | null;
};
