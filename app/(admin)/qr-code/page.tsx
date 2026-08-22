import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import QRCode from 'qrcode';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'QR-Code · Mise' };

export default async function QrCodePage() {
  const emp = await requireManagerPlus();
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: empRow } = await sb.from('employees').select('tenant_id').eq('id', emp.id).maybeSingle();
  if (!empRow?.tenant_id) redirect('/start');

  const { data: tenant } = await svc
    .from('tenants')
    .select('slug, name, storefront_settings, custom_domain')
    .eq('id', empRow.tenant_id)
    .single();
  if (!tenant) redirect('/start');

  const slug = tenant.slug;
  const stableUrl = `https://mise-gastro.de/go/${slug}`;
  const publicUrl =
    (tenant.storefront_settings as { public_url?: string } | null)?.public_url ??
    (tenant.custom_domain ? `https://${tenant.custom_domain}` : `https://mise-gastro.de/biss-app/${slug}`);

  const bigQr = await QRCode.toDataURL(stableUrl, {
    width: 600,
    margin: 3,
    color: { dark: '#0f2922', light: '#ffffff' },
    errorCorrectionLevel: 'H',
  });

  return (
    <>
      <PageHeader
        title="QR-Code"
        description="Dein QR-Code zum Drucken — bleibt für immer gültig auch wenn du die Domain wechselst."
        backHref="/shop"
      />

      <div className="max-w-2xl mx-auto">
        <div className="rounded-3xl border-2 border-matcha-900 bg-white p-8 shadow-xl text-center">
          <img src={bigQr} alt="QR-Code" className="mx-auto mb-4 w-72 h-72 sm:w-96 sm:h-96" />
          <div className="font-display text-xl font-bold mb-1">{tenant.name}</div>
          <div className="text-sm text-muted-foreground mb-1">Scannen → direkte Bestellung</div>
          <div className="text-xs font-mono text-muted-foreground mb-6 break-all">{publicUrl}</div>

          <div className="flex flex-wrap gap-2 justify-center">
            <a
              href={`/api/qr/${slug}?format=png&size=1200`}
              download={`qr-${slug}.png`}
              className="inline-flex items-center gap-2 rounded-xl bg-matcha-900 text-matcha-50 px-5 py-3 text-sm font-bold hover:bg-matcha-800"
            >
              PNG (1200×1200)
            </a>
            <a
              href={`/api/qr/${slug}?format=svg`}
              download={`qr-${slug}.svg`}
              className="inline-flex items-center gap-2 rounded-xl border-2 border-matcha-900 text-matcha-900 px-5 py-3 text-sm font-bold hover:bg-matcha-50"
            >
              SVG (Vektor)
            </a>
            <a
              href={`/api/qr/${slug}?format=png&size=2400`}
              download={`qr-${slug}-xl.png`}
              className="inline-flex items-center gap-2 rounded-xl border-2 border-matcha-900 text-matcha-900 px-5 py-3 text-sm font-bold hover:bg-matcha-50"
            >
              XL (2400×2400)
            </a>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border bg-amber-50 border-amber-200 p-4 text-sm text-amber-900">
          <div className="font-bold mb-1">Wichtig: dieser QR ist stabil</div>
          <p>Der QR encodet einen Mise-Redirector. Wenn du später eine andere Domain nimmst, ändern wir nur die Weiterleitung — der gedruckte QR bleibt gültig. Du druckst einmal und vergisst es.</p>
        </div>
      </div>
    </>
  );
}
