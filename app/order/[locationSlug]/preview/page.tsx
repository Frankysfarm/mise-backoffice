import { createServiceClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { PreviewGallery } from './gallery';

export const dynamic = 'force-dynamic';

export default async function PreviewPage({ params }: { params: Promise<{ locationSlug: string }> }) {
  const { locationSlug } = await params;
  const svc = createServiceClient();
  const slug = decodeURIComponent(locationSlug);

  const { data: tenant } = await svc.from('tenants').select('id, name').eq('slug', slug).maybeSingle();
  if (!tenant) notFound();

  const { data: location } = await svc.from('locations')
    .select('id, name, stadt, adresse')
    .eq('tenant_id', tenant.id).eq('aktiv', true).limit(1).maybeSingle();
  if (!location) notFound();

  const { data: categories } = await svc.from('menu_categories')
    .select('id, name, icon')
    .eq('location_id', location.id)
    .order('sort_order');

  const { data: items } = await svc.from('menu_items')
    .select('id, category_id, name, beschreibung, preis, beliebt, tags, allergene, bild_url')
    .in('category_id', (categories ?? []).map((c) => c.id));

  return <PreviewGallery tenantName={tenant.name} location={location} items={items ?? []} categories={categories ?? []} />;
}
