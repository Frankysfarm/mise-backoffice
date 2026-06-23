import { createServiceClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { BissStorefront } from './client';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug);
  const sb = createServiceClient();
  const { data: tenant } = await sb
    .from('tenants')
    .select('name')
    .eq('slug', decoded)
    .maybeSingle();
  const name = tenant?.name ?? 'Restaurant';
  return {
    title: `${name} · Jetzt bestellen`,
    description: `Bestelle direkt bei ${name} — frisch, schnell, lecker.`,
    themeColor: '#0f5132',
  };
}

export default async function BissSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug);
  const sb = createServiceClient();

  // Resolve slug → tenant → location
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(decoded);

  let locationId: string | null = null;
  let tenantId: string | null = null;

  if (isUuid) {
    locationId = decoded;
  } else {
    const { data: t } = await sb
      .from('tenants')
      .select('id')
      .eq('slug', decoded)
      .maybeSingle();
    tenantId = t?.id ?? null;
    if (tenantId) {
      const { data: loc } = await sb
        .from('locations')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('aktiv', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      locationId = loc?.id ?? null;
    }
  }

  if (!locationId) notFound();

  const [{ data: location }, { data: tenantRow }, { data: categories }, { data: items }] =
    await Promise.all([
      sb
        .from('locations')
        .select('id,name,adresse,stadt,plz,telefon,tenant_id')
        .eq('id', locationId)
        .eq('aktiv', true)
        .maybeSingle(),
      tenantId
        ? sb
            .from('tenants')
            .select(
              'name,slug,logo_url,hero_image_url,theme_primary,durchschnittliche_lieferzeit_min,mindestbestellwert,liefergebuehr',
            )
            .eq('id', tenantId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      sb
        .from('menu_categories')
        .select('id,name,icon,sort_order')
        .eq('location_id', locationId)
        .eq('aktiv', true)
        .order('sort_order'),
      sb
        .from('menu_items')
        .select('id,name,beschreibung,preis,bild_url,category_id,location_id,verfuegbar,beliebt,sort_order,option_groups')
        .eq('location_id', locationId)
        .eq('verfuegbar', true)
        .order('sort_order'),
    ]);

  if (!location) notFound();

  const t = tenantRow as any;

  return (
    <BissStorefront
      location={{
        id: location.id,
        name: location.name,
        adresse: location.adresse ?? null,
        stadt: location.stadt ?? null,
        plz: location.plz ?? null,
        telefon: location.telefon ?? null,
      }}
      tenant={{
        name: t?.name ?? location.name,
        slug: decoded,
        logoUrl: t?.logo_url ?? null,
        heroImageUrl: t?.hero_image_url ?? null,
        primary: t?.theme_primary ?? null,
        deliveryTimeMin: t?.durchschnittliche_lieferzeit_min ?? 35,
        minOrder: Number(t?.mindestbestellwert ?? 12),
        deliveryFee: Number(t?.liefergebuehr ?? 0),
      }}
      categories={(categories as any[]) ?? []}
      items={(items as any[]) ?? []}
    />
  );
}
