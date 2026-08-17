import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createServiceClient } from '@/lib/supabase/server';
import {
  createDefaultStorefrontDocument,
  normalizeStorefrontBuilderEnvelope,
} from '@/lib/storefront-builder';
import { ShopDesignClient } from './client';

export const dynamic = 'force-dynamic';

export default async function ShopDesignPage() {
  const employee = await requireManagerPlus();
  if (!employee.tenant_id) redirect('/start');
  const service = createServiceClient();
  const { data: tenant } = await service
    .from('tenants')
    .select('id, name, slug, storefront_theme_id, storefront_settings, theme_primary, theme_accent, hero_image_url, logo_url')
    .eq('id', employee.tenant_id)
    .maybeSingle();
  if (!tenant) redirect('/start');

  const { data: locations } = await service
    .from('locations')
    .select('id')
    .eq('tenant_id', tenant.id)
    .eq('aktiv', true);
  const locationIds = (locations ?? []).map((location) => location.id);
  const [{ data: categories }, { data: products }] = await Promise.all([
    service
      .from('menu_categories')
      .select('id, name, icon, sort_order')
      .in('location_id', locationIds.length ? locationIds : ['00000000-0000-0000-0000-000000000000'])
      .eq('aktiv', true)
      .order('sort_order'),
    service
      .from('menu_items')
      .select('id, name, preis, bild_url, category_id, beliebt, sort_order')
      .in('location_id', locationIds.length ? locationIds : ['00000000-0000-0000-0000-000000000000'])
      .eq('verfuegbar', true)
      .order('sort_order'),
  ]);

  const settings = (tenant.storefront_settings ?? {}) as Record<string, any>;
  const fallback = createDefaultStorefrontDocument({
    themeId: tenant.storefront_theme_id,
    primary: settings.theme?.primary ?? tenant.theme_primary,
    accent: settings.theme?.accent ?? tenant.theme_accent,
    background: settings.theme?.background,
    heroImageUrl: tenant.hero_image_url,
    heroBadge: settings.hero?.badge,
    heroTitle: settings.hero?.title,
    heroSubtitle: settings.hero?.subtitle,
  });
  const envelope = normalizeStorefrontBuilderEnvelope(settings.storefront_builder, fallback);

  return (
    <ShopDesignClient
      tenant={{
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        logoUrl: tenant.logo_url,
        heroImageUrl: tenant.hero_image_url,
      }}
      initialEnvelope={envelope}
      products={(products ?? []).map((product) => ({ ...product, preis: Number(product.preis) }))}
      categories={categories ?? []}
    />
  );
}
