import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowRight, Banknote, Check, CreditCard, Eye, Globe,
  Grid, Palette, Plus, Printer, QrCode, ShoppingBag, UtensilsCrossed, Wallet,
} from 'lucide-react';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'QR-Bestellsystem (Tisch) · Mise' };

export default async function QRBestellsystemPage() {
  const emp = await requireManagerPlus();
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: empRow } = await sb.from('employees').select('tenant_id,location_id').eq('id', emp.id).maybeSingle();
  if (!empRow?.tenant_id || !empRow.location_id) redirect('/start');

  const [
    { data: tenant },
    { count: tischeCount },
    { data: tischeMitToken },
    { count: itemsCount },
    { data: location },
  ] = await Promise.all([
    svc.from('tenants')
      .select('name, slug, logo_url, hero_image_url, custom_domain, custom_domain_status, stripe_connect_charges_enabled')
      .eq('id', empRow.tenant_id).single(),
    svc.from('restaurant_tables').select('id', { count: 'exact', head: true })
      .eq('location_id', empRow.location_id).eq('aktiv', true),
    svc.from('restaurant_tables').select('id, nummer, qr_token')
      .eq('location_id', empRow.location_id).eq('aktiv', true)
      .order('sort_order').limit(3),
    svc.from('menu_items').select('id', { count: 'exact', head: true })
      .eq('location_id', empRow.location_id).eq('verfuegbar', true),
    svc.from('locations').select('universal_qr_token, name')
      .eq('id', empRow.location_id).single(),
  ]);

  const t = tenant as {
    name: string; slug: string;
    logo_url: string | null; hero_image_url: string | null;
    custom_domain: string | null; custom_domain_status: string | null;
    stripe_connect_charges_enabled: boolean | null;
  } | null;

  const tische = tischeCount ?? 0;
  const items = itemsCount ?? 0;
  const designOk = Boolean(t?.logo_url || t?.hero_image_url);
  const stripeOk = Boolean(t?.stripe_connect_charges_enabled);
  const domainOk = Boolean(t?.custom_domain && t.custom_domain_status === 'verified');

  const baseUrl = domainOk && t?.custom_domain ? `https://${t.custom_domain}` : 'https://mise-gastro.de';
  const universalToken = (location as { universal_qr_token?: string } | null)?.universal_qr_token;
  const sampleToken = (tischeMitToken?.[0] as { qr_token?: string } | undefined)?.qr_token;

  /* Setup-Status aus den Voraussetzungen ableiten */
  const steps = [
    { done: tische > 0, label: 'Tische angelegt' },
    { done: items > 0, label: 'Speisekarte gepflegt' },
    { done: designOk, label: 'Design angepasst' },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const allReady = doneCount === steps.length;

  return (
    <>
      <PageHeader
        title="QR-Bestellsystem (Tisch)"
        description="Gäste scannen den QR-Code am Tisch, sehen deine Speisekarte, bestellen und bezahlen — ohne Kellner zu rufen."
        backHref="/pos/setup"
      />

      {/* Status-Banner */}
      <div className={cn(
        'rounded-2xl p-5 mb-6 flex items-center gap-4',
        allReady ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200',
      )}>
        <div className={cn(
          'h-14 w-14 rounded-2xl grid place-items-center shrink-0',
          allReady ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white',
        )}>
          <QrCode className="h-7 w-7" />
        </div>
        <div className="flex-1">
          <h2 className="font-display text-xl font-black">
            {allReady ? 'Dein QR-Bestellsystem ist live' : `${doneCount} von ${steps.length} Schritten erledigt`}
          </h2>
          <p className="text-sm text-gray-700 mt-1">
            {allReady
              ? 'Drucke die QR-Codes aus, kleb sie auf die Tische — fertig.'
              : 'Noch ein paar Klicks bis Gäste am Tisch bestellen können.'}
          </p>
        </div>
        <div className="hidden sm:flex flex-col gap-1">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <div className={cn('h-4 w-4 rounded-full grid place-items-center shrink-0', s.done ? 'bg-emerald-500 text-white' : 'bg-white border-2 border-amber-400')}>
                {s.done && <Check className="h-3 w-3" strokeWidth={3} />}
              </div>
              <span className={cn('font-bold', s.done ? 'text-emerald-800' : 'text-amber-800')}>
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Live-Preview */}
      <div className="bg-white rounded-2xl border p-5 mb-8">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="h-12 w-12 rounded-xl bg-blue-100 text-blue-700 grid place-items-center shrink-0">
            <Eye className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-[280px]">
            <h3 className="font-bold text-lg">Was sieht der Gast?</h3>
            <p className="text-sm text-gray-600 mt-1">Klick auf einen Link um die Bestellseite mit den Augen deiner Gäste zu sehen.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {sampleToken && (
              <a
                href={`${baseUrl}/t/${sampleToken}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm font-bold"
              >
                <Eye className="h-4 w-4" /> Tisch-Bestellseite ansehen
              </a>
            )}
            {universalToken && (
              <a
                href={`${baseUrl}/here/${universalToken}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-white border-2 border-blue-600 text-blue-700 hover:bg-blue-50 px-4 py-2 text-sm font-bold"
              >
                <Eye className="h-4 w-4" /> Universal-QR
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Schritte */}
      <h2 className="font-display text-2xl font-black mb-1">Schritt für Schritt</h2>
      <p className="text-gray-600 mb-4">Klick durch die Karten — jede ist eigenständig konfigurierbar.</p>

      <div className="space-y-4">
        <Step
          number={1}
          done={tische > 0}
          icon={Grid}
          title="Tische anlegen"
          stat={`${tische} ${tische === 1 ? 'Tisch' : 'Tische'} aktiv`}
          description="Jeder Tisch bekommt seine Nummer + Sitzplätze. Mise erzeugt automatisch einen sicheren QR-Token."
          primary={{ label: tische === 0 ? 'Ersten Tisch anlegen' : 'Tische verwalten', href: '/pos/tables' }}
          secondary={{ label: 'Floor-Plan zeichnen', href: '/pos/tables/layout' }}
        />

        <Step
          number={2}
          done={tische > 0}
          icon={Printer}
          title="QR-Codes drucken"
          stat="2 Drucker-Modi"
          description="Pro Tisch ein QR-Code (Tisch-Nr eingebrannt) ODER ein Universal-QR (Aufsteller im Laden, Gast wählt Tisch). Beide auf A4 mit deinem Logo."
          primary={{ label: 'Alle QR-Codes drucken (A4)', href: '/pos/tables/print' }}
          secondary={tische > 0 ? { label: 'Universal-QR drucken', href: '/api/pos/universal-qr' } : undefined}
          disabled={tische === 0}
          disabledHint="Erst Tische anlegen"
        />

        <Step
          number={3}
          done={items > 0}
          icon={UtensilsCrossed}
          title="Speisekarte"
          stat={`${items} Artikel verfügbar`}
          description="Was gibt's zu bestellen? Kategorien, Preise, Allergene, Bilder. Alles was hier steht erscheint auf der QR-Bestellseite."
          primary={{ label: items === 0 ? 'Speisekarte aufbauen' : 'Karte bearbeiten', href: '/menu' }}
          secondary={{ label: 'Upsells & Cross-Sells', href: '/menu/upsells' }}
        />

        <Step
          number={4}
          done={designOk}
          icon={Palette}
          title="Design anpassen"
          stat={designOk ? 'Logo + Banner gesetzt' : 'Noch generisch'}
          description="Logo, Banner-Bild, Farben, Schriften. Dein Branding gilt sowohl für die Lieferseite als auch für den QR-Tisch — eine Anpassung, beide angepasst."
          primary={{ label: designOk ? 'Design ändern' : 'Logo + Banner hochladen', href: '/shop/qr-design' }}
        />

        <Step
          number={5}
          done={true}
          optional
          icon={CreditCard}
          title="Zahlung — wie kann der Gast zahlen?"
          stat="Bar · Karte · Online"
          description="Der Gast sieht im QR-Bestellsystem die Zahlungsoptionen. Bar/Karte = Kellner kassiert nach Bestellung. Online = Stripe verarbeitet (Apple Pay, Google Pay, Karte) und Tisch ist sofort bezahlt."
          primary={{ label: 'Zahlungsarten freischalten', href: '/shop/payments' }}
          secondary={!stripeOk ? { label: 'Stripe für Online verbinden', href: '/settings/stripe' } : { label: 'Stripe verwalten', href: '/settings/stripe' }}
        />

        <Step
          number={6}
          done={domainOk || items > 0}
          optional
          icon={Globe}
          title="Eigene Domain (optional)"
          stat={t?.custom_domain ? t.custom_domain : 'mise-gastro.de'}
          description="Statt mise-gastro.de/t/abc123 — verwende z. B. bestellen.dein-restaurant.de. Eine Domain für Lieferung + QR-Tisch."
          primary={{ label: t?.custom_domain ? 'Domain verwalten' : 'Domain verbinden', href: '/settings/domain' }}
        />
      </div>

      {/* Footer-Hinweis */}
      <div className="mt-10 p-5 rounded-2xl bg-gray-50 border border-gray-200 text-sm text-gray-700 leading-relaxed">
        <strong>So funktioniert&apos;s im Alltag:</strong> Der Gast scannt den QR an seinem Tisch → Mise erkennt automatisch welcher Tisch das ist → Karte öffnet sich → Bestellung läuft auf seinen Tisch → Bezahlung wahlweise sofort online oder am Ende beim Kellner. Der Kellner sieht offene Tische in der POS-Kasse vorne.
      </div>
    </>
  );
}

function Step({
  number, done, optional, icon: Icon, title, stat, description,
  primary, secondary, disabled, disabledHint,
}: {
  number: number;
  done: boolean;
  optional?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  stat: string;
  description: string;
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
  disabled?: boolean;
  disabledHint?: string;
}) {
  return (
    <div className={cn(
      'bg-white rounded-2xl border-2 p-5 transition',
      disabled ? 'opacity-60 border-gray-200' : done ? 'border-emerald-200' : 'border-gray-200 hover:border-matcha-700',
    )}>
      <div className="flex items-start gap-4">
        {/* Step-Nummer-Kreis */}
        <div className={cn(
          'h-12 w-12 rounded-2xl grid place-items-center shrink-0 font-display font-black text-lg',
          done ? 'bg-emerald-500 text-white' : 'bg-matcha-50 text-matcha-900 border-2 border-matcha-200',
        )}>
          {done ? <Check className="h-6 w-6" strokeWidth={3} /> : number}
        </div>

        {/* Inhalt */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Icon className="h-4 w-4 text-gray-500" />
            <h3 className="font-bold text-lg">{title}</h3>
            {optional && <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">Optional</span>}
            <span className="text-xs font-mono text-gray-600 ml-auto">{stat}</span>
          </div>
          <p className="text-sm text-gray-600 mt-1 leading-relaxed">{description}</p>
          {disabled && disabledHint && (
            <p className="text-xs text-amber-700 mt-2 italic">⚠ {disabledHint}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {disabled ? (
              <span className="inline-flex items-center gap-1 rounded-xl bg-gray-200 text-gray-500 px-4 py-2 text-sm font-bold cursor-not-allowed">
                {primary.label}
              </span>
            ) : (
              <Link
                href={primary.href}
                className={cn(
                  'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition',
                  done
                    ? 'bg-white border-2 border-emerald-300 text-emerald-800 hover:bg-emerald-50'
                    : 'bg-matcha-900 text-matcha-50 hover:bg-matcha-800',
                )}
              >
                {primary.label} <ArrowRight className="h-4 w-4" />
              </Link>
            )}
            {secondary && !disabled && (
              <Link
                href={secondary.href}
                className="inline-flex items-center gap-2 rounded-xl bg-white border-2 border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 text-sm font-bold"
              >
                {secondary.label}
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
