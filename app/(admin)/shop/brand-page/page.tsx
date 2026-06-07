import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { BrandPageEditor } from './client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Brand-Page · Mise' };

export default async function BrandPagePage() {
  const emp = await requireManagerPlus();
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: empRow } = await sb.from('employees').select('tenant_id').eq('id', emp.id).maybeSingle();
  if (!empRow?.tenant_id) redirect('/start');

  const { data: tenant } = await svc
    .from('tenants')
    .select('id, name, slug, storefront_settings, hero_image_url, logo_url')
    .eq('id', empRow.tenant_id)
    .single();
  if (!tenant) redirect('/start');

  return (
    <>
      <PageHeader
        title="Brand-Page"
        description="Deine eigene cinematic Landing-Page mit Tisch-Reservierung, Speisekarte, Social-Media-Buttons. Eigene Hero-Bild oder -Video, individuelle Buttons."
        backHref="/shop"
      />
      <BrandPageEditor tenant={tenant as { id: string; name: string; slug: string; storefront_settings: Record<string, unknown> | null; hero_image_url: string | null; logo_url: string | null }} />
    </>
  );
}
