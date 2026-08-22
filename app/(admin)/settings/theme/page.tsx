import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { ThemePicker } from './client';

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
        description="Theme wählen · Banner hochladen — so sieht deine Bestellseite aus."
      />
      <ThemePicker
        tenantId={tenant.id}
        slug={tenant.slug}
        current={tenant.storefront_theme_id ?? 'classic'}
        heroImageUrl={(tenant as any).hero_image_url ?? null}
        logoUrl={(tenant as any).logo_url ?? null}
      />
    </>
  );
}
