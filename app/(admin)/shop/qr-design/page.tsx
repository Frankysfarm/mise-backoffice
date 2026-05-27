import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { BannerLogoUpload } from '../design/banner-logo-upload';
import { BissWhitelabelCard } from '../design/biss-whitelabel-card';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'QR-Tisch Design · Mise' };

/**
 * /shop/qr-design — exakt das gleiche Design-Setup wie /shop/design,
 * aber für die QR-Tisch-Bestellseite. Schreibt in qr_*-Felder
 * (qr_brand_config, qr_logo_url, qr_hero_image_url) statt in die
 * Standard-Felder.
 *
 * Wichtig: Wenn QR-Modul nicht gebucht ist, wird diese Page durch
 * das Modul-Gate in (admin)/layout.tsx automatisch geblockt.
 */
export default async function QRShopDesignPage() {
  const emp = await requireManagerPlus();
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: empRow } = await sb.from('employees').select('tenant_id, location_id').eq('id', emp.id).maybeSingle();
  if (!empRow?.tenant_id) redirect('/start');

  const { data: tenant } = await svc
    .from('tenants')
    .select('id, slug, storefront_theme_id, qr_hero_image_url, qr_logo_url')
    .eq('id', empRow.tenant_id)
    .single();
  if (!tenant) redirect('/start');

  // Erster aktiver Tisch für Live-Preview
  const { data: testTable } = await svc.from('restaurant_tables')
    .select('qr_token').eq('location_id', empRow.location_id).eq('aktiv', true)
    .order('sort_order').limit(1).maybeSingle();

  const livePreviewUrl = testTable?.qr_token ? `/biss-app/t/${testTable.qr_token}` : undefined;

  return (
    <>
      <PageHeader
        title="QR-Tisch Design & Banner"
        description="Volles Brand-Studio für deine QR-Tisch-Bestellseite — Farben, Schriften, Texte, Animationen, Logo & Banner. Komplett unabhängig vom Online-Liefersystem."
        backHref="/qr-bestellsystem"
      />
      <div className="space-y-6">
        <BissWhitelabelCard
          tenantId={tenant.id}
          tenantSlug={tenant.slug}
          current={tenant.storefront_theme_id}
          mode="qr"
          livePreviewUrl={livePreviewUrl}
          qrToken={testTable?.qr_token ?? undefined}
        />
        <BannerLogoUpload
          tenantId={tenant.id}
          heroImageUrl={(tenant as { qr_hero_image_url?: string | null }).qr_hero_image_url ?? null}
          logoUrl={(tenant as { qr_logo_url?: string | null }).qr_logo_url ?? null}
          fieldPrefix="qr_"
          contextLabel="QR-Tisch-Bestellseite"
        />
      </div>
    </>
  );
}
