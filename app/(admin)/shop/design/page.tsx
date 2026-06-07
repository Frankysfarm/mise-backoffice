import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { BannerLogoUpload } from './banner-logo-upload';
import { Palette, Sparkles, Gift, ArrowRight } from 'lucide-react';

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
        description="Logo, Banner-Bild und Storefront-Texte für deine Online-Bestellseite."
        backHref="/shop"
      />
      <div className="space-y-6">

        {/* Quick-Links zu Settings die funktionieren */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link href="/storefront-settings" className="group rounded-2xl border bg-white p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 grid place-items-center">
                <Palette size={18} className="text-amber-600" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-sm">Texte & Tagline</div>
                <div className="text-xs text-muted-foreground">Hero-Banner, Loyalty-Texte</div>
              </div>
              <ArrowRight size={14} className="text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>
          <Link href="/storefront-settings" className="group rounded-2xl border bg-white p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 grid place-items-center">
                <Gift size={18} className="text-amber-600" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-sm">Welcome-Popup</div>
                <div className="text-xs text-muted-foreground">Gratis-Drinks auswählen</div>
              </div>
              <ArrowRight size={14} className="text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>
          <Link href="/storefront-settings" className="group rounded-2xl border bg-white p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 grid place-items-center">
                <Sparkles size={18} className="text-amber-600" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-sm">Cross-Sell</div>
                <div className="text-xs text-muted-foreground">Produkt-Vorschläge im Cart</div>
              </div>
              <ArrowRight size={14} className="text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>
        </div>

        <BannerLogoUpload
          tenantId={tenant.id}
          heroImageUrl={(tenant as any).hero_image_url ?? null}
          logoUrl={(tenant as any).logo_url ?? null}
        />
      </div>
    </>
  );
}
