import { createServiceClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import { cookies, headers } from 'next/headers';
import { detectLocale } from '@/lib/i18n-storefront';
import { Storefront } from './storefront';
import { StorefrontV2 } from './storefront-v2';
import { StorefrontAurora } from './storefront-aurora';
import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locationSlug: string }> }): Promise<Metadata> {
  const { locationSlug } = await params;
  const slug = decodeURIComponent(locationSlug);
  const supabase = createServiceClient();
  const { data: tenant } = await supabase
    .from('tenants').select('name').eq('slug', slug).maybeSingle();
  const restaurantName = tenant?.name ?? 'Restaurant';
  return {
    title: restaurantName + ' · Online bestellen',
    description: 'Bestelle direkt bei ' + restaurantName + ' — schnelle Lieferung, sichere Zahlung.',
    manifest: '/manifest.json',
    themeColor: '#0B0B0F',
    appleWebApp: {
      capable: true,
      statusBarStyle: 'default',
      title: restaurantName,
    },
    icons: {
      icon: [
        { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
      apple: '/apple-touch-icon.png',
    },
    other: {
      'mobile-web-app-capable': 'yes',
      'apple-mobile-web-app-status-bar-style': 'default',
    },
  };
}

export const dynamic = 'force-dynamic';

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ locationSlug: string }>;
  searchParams?: Promise<{ theme?: string; v?: string }>;
}) {
  const { locationSlug } = await params;
  const sp = (searchParams ? await searchParams : {}) as { theme?: string; v?: string };
  const VALID_THEMES = ['classic', 'bold', 'minimal', 'farmhouse', 'urban', 'aurora'];
  const themeOverride = sp.theme && VALID_THEMES.includes(sp.theme) ? sp.theme : null;
  const useV2 = sp.v === '2';
  const supabase = createServiceClient();

  const ck = await cookies();
  const hd = await headers();
  const locale = detectLocale(hd.get('accept-language'), ck.get('mise_locale')?.value);

  const slug = decodeURIComponent(locationSlug);
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);

  let location:
    | { id: string; name: string; adresse: string | null; stadt: string | null; plz: string | null; telefon: string | null; tenant_id: string | null }
    | null = null;

  if (isUuid) {
    const { data } = await supabase
      .from('locations')
      .select('id,name,adresse,stadt,plz,telefon,tenant_id')
      .eq('aktiv', true).eq('id', slug).maybeSingle();
    location = data;
  } else {
    const { data: tenant } = await supabase
      .from('tenants').select('id').eq('slug', slug).maybeSingle();
    if (tenant) {
      const { data } = await supabase
        .from('locations')
        .select('id,name,adresse,stadt,plz,telefon,tenant_id')
        .eq('tenant_id', tenant.id).eq('aktiv', true)
        .order('created_at', { ascending: true })
        .limit(1).maybeSingle();
      location = data;
    }
    if (!location) {
      const { data } = await supabase
        .from('locations')
        .select('id,name,adresse,stadt,plz,telefon,tenant_id')
        .eq('aktiv', true)
        .ilike('name', `%${slug}%`)
        .limit(1).maybeSingle();
      location = data;
    }
  }

  if (!location) notFound();

  const [{ data: categories }, { data: items }, { data: paymentMethods }, tenantRes] = await Promise.all([
    supabase.from('menu_categories').select('*').eq('location_id', location.id).eq('aktiv', true).order('sort_order'),
    supabase.from('menu_items').select('*, option_groups').eq('location_id', location.id).eq('verfuegbar', true).order('sort_order'),
    location.tenant_id
      ? supabase.from('tenant_payment_methods').select('*').eq('tenant_id', location.tenant_id).order('sort_order')
      : Promise.resolve({ data: [] }),
    location.tenant_id
      ? supabase.from('tenants').select('storefront_theme_id, name, slug, theme_primary, theme_accent, hero_image_url, logo_url, durchschnittliche_lieferzeit_min, mindestbestellwert, liefergebuehr').eq('id', location.tenant_id).single()
      : Promise.resolve({ data: null }),
  ]);

  const t = tenantRes.data as any;

  // === BISS-First (Default-Storefront seit 2026-05-03) ===
  // Alle Customer-Bestellungen gehen über /biss-app/<slug>. Die alten
  // Aurora/Bento/Liquid/etc.-Themes sind deprecated — BISS ist die einzige
  // produktive Customer-Storefront.
  redirect(`/biss-app/${encodeURIComponent(slug)}`);

  // V=<theme> — themed Storefront per User-Spec
  const VALID_V_THEMES = ['aurora', 'aurora-v3', 'bento-pro', 'liquid', 'konkret', 'gazette', 'noir'];
  const NEW_DEFAULT_THEMES = ['aurora-v3', 'bento-pro', 'liquid', 'konkret', 'gazette', 'noir'];

  // 1) Explicit ?v= query param wins
  const _spV: string | null = sp.v ?? null;
  let themedV: string | null = _spV !== null && VALID_V_THEMES.includes(_spV as string) ? _spV : null;

  // 2) Fall back to tenant's saved theme if it's one of the new themes
  if (!themedV && t?.storefront_theme_id && NEW_DEFAULT_THEMES.includes(t.storefront_theme_id)) {
    themedV = t.storefront_theme_id === 'aurora' ? 'aurora-v3' : t.storefront_theme_id;
  }

  // 3) If theme override comes via ?theme= and matches a new theme, use it
  if (!themedV && themeOverride && NEW_DEFAULT_THEMES.includes(themeOverride as string)) {
    themedV = themeOverride;
  }

  if (themedV) {
    return (
      <StorefrontAurora
        themeV={themedV ?? undefined}
        location={location!}
        tenant={{
          name: t?.name ?? location!.name,
          slug: t?.slug ?? slug,
          primary: t?.theme_primary ?? null,
          accent: t?.theme_accent ?? null,
          hero_image_url: t?.hero_image_url ?? null,
          logo_url: t?.logo_url ?? null,
          delivery_time_min: t?.durchschnittliche_lieferzeit_min ?? 30,
          min_order: Number(t?.mindestbestellwert ?? 12),
          delivery_fee: Number(t?.liefergebuehr ?? 0),
        }}
        categories={(categories as any) ?? []}
        items={(items as any) ?? []}
      />
    );
  }

  // V2 Branch
  if (useV2) {
    return (
      <StorefrontV2
        location={location!}
        tenant={{
          name: t?.name ?? location!.name,
          slug: t?.slug ?? slug,
          primary: t?.theme_primary ?? null,
          hero_image_url: t?.hero_image_url ?? null,
          logo_url: t?.logo_url ?? null,
          delivery_time_min: t?.durchschnittliche_lieferzeit_min ?? 30,
          min_order: Number(t?.mindestbestellwert ?? 12),
          delivery_fee: Number(t?.liefergebuehr ?? 0),
        }}
        categories={(categories as any) ?? []}
        items={(items as any) ?? []}
      />
    );
  }

  // V1 (legacy)
  return (
    <Storefront
      location={location!}
      categories={categories ?? []}
      items={items ?? []}
      paymentMethods={(paymentMethods as any[]) ?? []}
      themeId={themeOverride ?? t?.storefront_theme_id ?? 'classic'}
      heroImageUrl={t?.hero_image_url ?? null}
      logoUrl={t?.logo_url ?? null}
      locale={locale}
      deliveryTimeMin={t?.durchschnittliche_lieferzeit_min ?? 35}
      minOrder={Number(t?.mindestbestellwert ?? 12)}
      tenantDeliveryFee={Number(t?.liefergebuehr ?? 0)}
    />
  );
}
