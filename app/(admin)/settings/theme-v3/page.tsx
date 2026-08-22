import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { ThemePickerV3 } from './client-v3';

export const dynamic = 'force-dynamic';

export default async function ThemeSettingsPage() {
  const emp = await requireManagerPlus();
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: empTenant } = await sb.from('employees').select('tenant_id').eq('id', emp.id).maybeSingle();
  if (!empTenant?.tenant_id) redirect('/start');

  const { data: tenant } = await svc
    .from('tenants')
    .select('id, slug, storefront_theme_id, hero_image_url, logo_url')
    .eq('id', empTenant.tenant_id)
    .single();
  if (!tenant) redirect('/start');

  return (
    <>
      <PageHeader
        title="Design der Bestellseite"
        description="Wähle eines der 6 Designs nach Spec — Aurora, Bento Pro, Liquid, Konkret, Gazette oder Noir."
      />
      <ThemePickerV3
        tenantId={tenant.id}
        tenantSlug={tenant.slug}
        current={tenant.storefront_theme_id}
      />
    </>
  );
}
