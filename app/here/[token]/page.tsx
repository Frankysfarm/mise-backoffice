import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { UniversalStorefront } from './client';

export const dynamic = 'force-dynamic';

export default async function UniversalOrderPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const svc = createServiceClient();

  const { data: location } = await svc.from('locations')
    .select('id, name, adresse, stadt, plz, tenant_id')
    .eq('universal_qr_token', token)
    .maybeSingle();

  if (!location) notFound();

  const [{ data: tenant }, { data: categories }, { data: items }, { data: tables }, { data: relations }] = await Promise.all([
    svc.from('tenants')
      .select('name, slug, logo_url, hero_image_url, storefront_theme_id, theme_primary, theme_accent')
      .eq('id', location.tenant_id).single(),
    svc.from('menu_categories').select('*').eq('location_id', location.id).eq('aktiv', true).order('sort_order'),
    svc.from('menu_items').select('*').eq('location_id', location.id).eq('verfuegbar', true).order('sort_order'),
    svc.from('restaurant_tables').select('id, nummer, name, bereich').eq('location_id', location.id).eq('aktiv', true).order('sort_order'),
    svc.from('menu_item_relations').select('item_id, related_item_id, typ, sort_order').in('typ', ['crosssell', 'upsell']).order('sort_order'),
  ]);

  return (
    <UniversalStorefront
      location={location as any}
      tenant={tenant as any}
      categories={(categories as any[]) ?? []}
      items={(items as any[]) ?? []}
      tables={(tables as any[]) ?? []}
      relations={(relations as any[]) ?? []}
    />
  );
}
