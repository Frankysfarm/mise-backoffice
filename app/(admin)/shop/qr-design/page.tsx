import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { BannerLogoUpload } from '../design/banner-logo-upload';
import { BissWhitelabelCard } from '../design/biss-whitelabel-card';
import { QRBrandingForm } from './qr-branding-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'QR-Tisch Design · Mise' };

/**
 * /shop/qr-design — Brand-Setup für die QR-Tisch-Bestellseite. Speichert
 * Farben und Texte getrennt vom Liefershop und kombiniert sie mit eigenem
 * QR-Logo und Banner.
 */
export default async function QRShopDesignPage() {
  const emp = await requireManagerPlus();
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: empRow } = await sb
    .from('employees')
    .select('tenant_id, location_id')
    .eq('id', emp.id)
    .maybeSingle();
  if (!empRow?.tenant_id) redirect('/start');

  const { data: tenant } = await svc
    .from('tenants')
    .select('id,slug,storefront_theme_id,theme_primary,theme_accent,qr_hero_image_url,qr_logo_url,qr_theme_primary,qr_theme_accent,qr_welcome_text,qr_cta_label')
    .eq('id', empRow.tenant_id)
    .single();
  if (!tenant) redirect('/start');

  const { data: testTable } = await svc
    .from('restaurant_tables')
    .select('qr_token')
    .eq('location_id', empRow.location_id)
    .eq('aktiv', true)
    .order('sort_order')
    .limit(1)
    .maybeSingle();

  const livePreviewUrl = testTable?.qr_token ? `/t/${testTable.qr_token}` : undefined;

  return (
    <>
      <PageHeader
        title="QR-Tisch Design & Banner"
        description="Farben, Texte, Logo und Banner für die mobile Bestellung direkt am Tisch."
        backHref="/qr-bestellsystem"
      />
      <div className="space-y-6">
        <QRBrandingForm
          initialPrimary={tenant.qr_theme_primary ?? tenant.theme_primary ?? '#14532d'}
          initialAccent={tenant.qr_theme_accent ?? tenant.theme_accent ?? '#4ae68a'}
          initialWelcomeText={tenant.qr_welcome_text ?? 'Direkt am Tisch bestellen. Wir bringen alles zu dir.'}
          initialCtaLabel={tenant.qr_cta_label ?? 'Zur Bestellung'}
        />
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
          heroImageUrl={tenant.qr_hero_image_url ?? null}
          logoUrl={tenant.qr_logo_url ?? null}
          fieldPrefix="qr_"
          contextLabel="QR-Tisch-Bestellseite"
        />
      </div>
    </>
  );
}
