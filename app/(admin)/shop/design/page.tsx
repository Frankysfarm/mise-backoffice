import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { BannerLogoUpload } from './banner-logo-upload';
import { BissWhitelabelCard } from './biss-whitelabel-card';

export const dynamic = 'force-dynamic';

export default async function ShopDesignPage() {
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
        title="Design & Banner"
        description="Dein Online-Shop läuft mit der BISS-Whitelabel-App. Im Brand-Studio passt du Farben, Schriften, Texte, Animationen und deine Domain an."
        backHref="/shop"
      />
      <div className="space-y-6">
        <BissWhitelabelCard
          tenantId={tenant.id}
          tenantSlug={tenant.slug}
          current={tenant.storefront_theme_id}
        />
        <BannerLogoUpload
          tenantId={tenant.id}
          heroImageUrl={(tenant as any).hero_image_url ?? null}
          logoUrl={(tenant as any).logo_url ?? null}
        />
      </div>
    </>
  );
}
