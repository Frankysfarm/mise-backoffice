import { redirect } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { DomainSettings } from '@/app/(admin)/settings/domain/client';
import { ShieldCheck, Download } from 'lucide-react';
import QRCode from 'qrcode';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Domain · Online-Shop · Mise' };

type TenantRow = {
  id: string;
  slug: string;
  name: string;
  custom_domain: string | null;
  custom_domain_status: 'pending' | 'verified' | 'active' | 'dns_ok' | 'provisioning' | 'error' | null;
  custom_domain_verified_at: string | null;
  custom_domain_error: string | null;
};

export default async function ShopDomainPage() {
  const emp = await requireManagerPlus();
  if (!emp.tenant_id) redirect('/start');
  const svc = createServiceClient();

  const { data: tenant } = await svc
    .from('tenants')
    .select('id, slug, name, custom_domain, custom_domain_status, custom_domain_verified_at, custom_domain_error')
    .eq('id', emp.tenant_id)
    .single<TenantRow>();
  if (!tenant) redirect('/start');

  // QR-Code immer auf STABLEN Redirector — bleibt gleich auch wenn Domain wechselt
  const stableUrl = `https://mise-gastro.de/go/${tenant.slug}`;
  const qrDataUrl = await QRCode.toDataURL(stableUrl, {
    width: 280,
    margin: 2,
    color: { dark: '#0f2922', light: '#ffffff' },
    errorCorrectionLevel: 'H',
  });

  return (
    <>
      <PageHeader
        title="Eigene Domain"
        description="Verbinde eine eigene Web-Adresse — z. B. bestellen.dein-restaurant.de — mit deinem Online-Bestellshop und deinen QR-Tisch-Codes."
        backHref="/shop"
      />

      {/* QR-Code Box — bleibt FEST egal welche Domain */}
      <div className="mb-6 rounded-2xl border-2 border-matcha-200 bg-gradient-to-br from-matcha-50 to-white p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center gap-5">
          <img src={qrDataUrl} alt="QR-Code" className="w-40 h-40 rounded-xl border-2 border-white shadow-md flex-shrink-0" />
          <div className="flex-1 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs font-bold uppercase tracking-wider text-matcha-900 mb-1">
              <ShieldCheck size={14} /> Dein fester QR-Code
            </div>
            <div className="font-display text-xl font-bold mb-1">Bleibt für immer gültig</div>
            <p className="text-sm text-muted-foreground mb-3">
              Auch wenn du die Domain wechselst, funktioniert der gedruckte QR weiter. Encoded URL: <span className="font-mono text-xs bg-matcha-100 px-1.5 py-0.5 rounded">{stableUrl}</span>
            </p>
            <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
              <a
                href={`/api/qr/${tenant.slug}?format=png&size=1200`}
                download={`qr-${tenant.slug}.png`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-matcha-900 text-matcha-50 px-3 py-2 text-xs font-bold hover:bg-matcha-800"
              >
                <Download size={12} /> PNG
              </a>
              <a
                href={`/api/qr/${tenant.slug}?format=svg`}
                download={`qr-${tenant.slug}.svg`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-matcha-900 text-matcha-900 px-3 py-2 text-xs font-bold hover:bg-matcha-50"
              >
                <Download size={12} /> SVG
              </a>
              <a
                href={`/api/qr/${tenant.slug}?format=png&size=2400`}
                download={`qr-${tenant.slug}-xl.png`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-matcha-900 text-matcha-900 px-3 py-2 text-xs font-bold hover:bg-matcha-50"
              >
                <Download size={12} /> XL
              </a>
            </div>
          </div>
        </div>
      </div>

      <DomainSettings
        tenantId={tenant.id}
        slug={tenant.slug}
        name={tenant.name}
        currentDomain={tenant.custom_domain}
        status={tenant.custom_domain_status}
        verifiedAt={tenant.custom_domain_verified_at}
        lastError={tenant.custom_domain_error}
      />
    </>
  );
}
