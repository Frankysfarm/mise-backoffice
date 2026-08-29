import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { TableStorefront } from './storefront';

export const dynamic = 'force-dynamic';

export default async function TableOrderPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const svc = createServiceClient();
  const { data: table } = await svc
    .from('restaurant_tables')
    .select('id,nummer,name,bereich,tenant_id,location_id,aktiv,status,qr_disabled_at')
    .eq('qr_token', token)
    .maybeSingle();
  if (!table?.aktiv || table.qr_disabled_at || table.status === 'gesperrt') notFound();

  const [{ data: tenant }, { data: location }, { data: categories }, { data: items }] = await Promise.all([
    svc.from('tenants')
      .select('name,slug,logo_url,hero_image_url,storefront_theme_id,theme_primary,theme_accent,qr_logo_url,qr_hero_image_url,stripe_connect_account_id,stripe_connect_charges_enabled')
      .eq('id', table.tenant_id)
      .single(),
    svc.from('locations')
      .select('name,adresse,stadt,plz')
      .eq('id', table.location_id)
      .eq('tenant_id', table.tenant_id)
      .single(),
    svc.from('menu_categories')
      .select('*')
      .eq('tenant_id', table.tenant_id)
      .eq('location_id', table.location_id)
      .eq('aktiv', true)
      .order('sort_order'),
    svc.from('menu_items')
      .select('*')
      .eq('tenant_id', table.tenant_id)
      .eq('location_id', table.location_id)
      .eq('verfuegbar', true)
      .order('sort_order'),
  ]);
  if (!tenant || !location) notFound();

  const itemIds = (items ?? []).map((item) => item.id);
  const { data: relations } = itemIds.length
    ? await svc.from('menu_item_relations')
      .select('item_id,related_item_id,typ,sort_order')
      .in('item_id', itemIds)
      .in('related_item_id', itemIds)
      .in('typ', ['crosssell', 'upsell'])
      .order('sort_order')
    : { data: [] };

  return (
    <TableStorefront
      table={table}
      tenant={tenant}
      location={location}
      categories={categories ?? []}
      items={items ?? []}
      relations={relations ?? []}
      qrToken={token}
      onlinePaymentEnabled={Boolean(tenant.stripe_connect_account_id && tenant.stripe_connect_charges_enabled)}
    />
  );
}
