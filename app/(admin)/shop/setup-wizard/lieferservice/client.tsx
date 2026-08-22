'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight, Check, CreditCard, Globe, Image as ImageIcon, KeyRound, MapPin,
  Printer, ShoppingBag, Sparkles, TestTube, Truck, UtensilsCrossed,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { cn } from '@/lib/utils';
import { KioskAccountSection } from './KioskAccountSection';

interface StepStatus {
  stripe: boolean;
  zones: boolean;
  hours: boolean;
  menu: boolean;
  design: boolean;
  printer: boolean;
  kioskAccount: boolean;
  domain: boolean;
  test: boolean;
}

interface Counts {
  zones: number;
  menuItems: number;
}

interface Props {
  tenantName: string;
  tenantSlug: string;
  stepStatus: StepStatus;
  counts: Counts;
}

interface Step {
  key: keyof StepStatus;
  num: number;
  title: string;
  desc: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  optional?: boolean;
  inline?: 'kiosk-account';
  doneLabel: (counts: Counts) => string;
  todoLabel: string;
}

const STEPS: Step[] = [
  {
    key: 'stripe',
    num: 1,
    title: 'Stripe-Konto verbinden',
    desc: 'Damit Kunden online mit Karte, Apple Pay oder Google Pay zahlen können. Dein eigenes Stripe-Konto, Geld kommt direkt zu dir.',
    href: '/settings/stripe',
    icon: CreditCard,
    doneLabel: () => 'Stripe verbunden',
    todoLabel: 'Jetzt verbinden',
  },
  {
    key: 'zones',
    num: 2,
    title: 'Lieferzonen + Liefergebühren',
    desc: 'Bis wie weit lieferst du? Pro Zone (Kilometer): Liefergebühr und Mindestbestellwert.',
    href: '/shop/delivery',
    icon: MapPin,
    doneLabel: (c) => `${c.zones} Zone${c.zones === 1 ? '' : 'n'} angelegt`,
    todoLabel: 'Lieferradius festlegen',
  },
  {
    key: 'hours',
    num: 3,
    title: 'Öffnungszeiten für Lieferung',
    desc: 'An welchen Tagen + Uhrzeiten lieferst du? Kunden bestellen nur in diesen Slots.',
    href: '/shop/hours',
    icon: Globe,
    doneLabel: () => 'Zeiten gepflegt',
    todoLabel: 'Zeiten setzen',
  },
  {
    key: 'menu',
    num: 4,
    title: 'Speisekarte für Lieferung',
    desc: 'Welche Produkte können bestellt werden? Pizza, Pasta, Getränke — alle Kategorien aktivieren.',
    href: '/menu',
    icon: UtensilsCrossed,
    doneLabel: (c) => `${c.menuItems} Produkt${c.menuItems === 1 ? '' : 'e'} verfügbar`,
    todoLabel: 'Speisekarte pflegen',
  },
  {
    key: 'design',
    num: 5,
    title: 'Design + Logo',
    desc: 'Logo, Farben, Hero-Bild — wie sieht deine Bestell-Seite aus? Kunden vertrauen schöneren Shops mehr.',
    href: '/shop/design',
    icon: Sparkles,
    doneLabel: () => 'Design gepflegt',
    todoLabel: 'Design einrichten',
  },
  {
    key: 'printer',
    num: 6,
    title: 'Bondrucker einrichten',
    desc: 'Bestellungen drucken automatisch sobald sie reinkommen. Per Bluetooth über Mise POS-App auf iPad/iPhone.',
    href: '/pos/printers',
    icon: Printer,
    doneLabel: () => 'Drucker eingerichtet',
    todoLabel: 'Drucker verbinden',
  },
  {
    key: 'kioskAccount',
    num: 7,
    title: 'Login-Account für iPad',
    desc: 'Damit du auf dem iPad nur einmal eingibst und dauerhaft eingeloggt bleibst. System erzeugt automatisch Email + Passwort.',
    href: '#',
    icon: KeyRound,
    inline: 'kiosk-account',
    doneLabel: () => 'Account aktiv',
    todoLabel: 'Account erstellen',
  },
  {
    key: 'domain',
    num: 8,
    title: 'Eigene Domain (optional)',
    desc: 'Lieferung über deine eigene Domain (z.B. lieferung.dein-restaurant.de) statt mise-gastro.de.',
    href: '/settings/domain',
    icon: Globe,
    optional: true,
    doneLabel: () => 'Domain verbunden',
    todoLabel: 'Domain einrichten',
  },
  {
    key: 'test',
    num: 9,
    title: 'Test-Bestellung machen',
    desc: 'Bestelle einmal selbst über deinen Shop um zu prüfen dass alles läuft (Bestelleingang, Bondruck, Email-Bestätigung). Sobald die erste echte Lieferung-Bestellung reinkommt, ist dieser Schritt automatisch erledigt.',
    href: 'https://mise-gastro.de/biss-app/{slug}',
    icon: TestTube,
    doneLabel: () => 'Erste Bestellung eingegangen',
    todoLabel: 'Bestell-Seite öffnen',
  },
];

export function LieferserviceWizardClient({ tenantName, tenantSlug, stepStatus, counts }: Props) {
  const requiredSteps = STEPS.filter((s) => !s.optional);
  const doneCount = requiredSteps.filter((s) => stepStatus[s.key]).length;
  const totalRequired = requiredSteps.length;
  const progressPct = Math.round((doneCount / totalRequired) * 100);
  const allDone = doneCount === totalRequired;

  const [activeStep, setActiveStep] = useState<number>(() => {
    const firstTodo = STEPS.find((s) => !stepStatus[s.key]);
    return firstTodo?.num ?? 1;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="🚚 Lieferservice einrichten"
        description={`${tenantName} — schritt für Schritt zum Live-Betrieb`}
      />

      <div className="rounded-3xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100 p-6">
        <div className="flex items-start gap-4">
          <div className="h-14 w-14 rounded-2xl bg-emerald-600 text-white grid place-items-center shrink-0">
            <Truck className="h-7 w-7" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-3 mb-2">
              <h2 className="font-display text-xl font-black text-emerald-900">
                {allDone ? 'Lieferservice ist LIVE 🎉' : `${doneCount} von ${totalRequired} Schritten erledigt`}
              </h2>
              <span className="font-display text-2xl font-black text-emerald-700">{progressPct}%</span>
            </div>
            <div className="h-3 rounded-full bg-emerald-200 overflow-hidden">
              <div
                className="h-full bg-emerald-600 transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            {allDone ? (
              <p className="mt-3 text-sm text-emerald-900">
                Alle Schritte erledigt. Kunden können jetzt bestellen unter{' '}
                <Link
                  href={`https://mise-gastro.de/biss-app/${tenantSlug}` as never}
                  className="font-bold underline"
                  target="_blank"
                >
                  mise-gastro.de/biss-app/{tenantSlug}
                </Link>
              </p>
            ) : (
              <p className="mt-3 text-sm text-emerald-900">
                Klicke jeden Schritt durch — sobald alle erledigt sind, ist dein Lieferservice live.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {STEPS.map((step) => {
          const done = stepStatus[step.key];
          const isActive = activeStep === step.num;
          const Icon = step.icon;

          return (
            <div
              key={step.key}
              className={cn(
                'rounded-2xl border-2 bg-white overflow-hidden transition-all',
                done && 'border-emerald-300 bg-emerald-50/30',
                !done && isActive && 'border-zinc-900 shadow-lg',
                !done && !isActive && 'border-zinc-200',
              )}
            >
              <button
                onClick={() => setActiveStep(isActive ? -1 : step.num)}
                className="w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-zinc-50/60"
              >
                <div
                  className={cn(
                    'h-11 w-11 rounded-xl grid place-items-center shrink-0 font-display font-black',
                    done && 'bg-emerald-600 text-white',
                    !done && 'bg-zinc-100 text-zinc-700',
                  )}
                >
                  {done ? <Check className="h-6 w-6" /> : step.num}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display font-black text-base">{step.title}</h3>
                    {step.optional && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded">
                        Optional
                      </span>
                    )}
                    {done && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                        Erledigt
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-600 truncate mt-0.5">
                    {done ? step.doneLabel(counts) : step.desc}
                  </p>
                </div>
                <Icon className="h-5 w-5 text-zinc-400 shrink-0" />
              </button>

              {isActive && (
                <div className="px-5 pb-5 -mt-1 pl-20">
                  <p className="text-sm text-zinc-700 leading-relaxed mb-3">{step.desc}</p>
                  {step.inline === 'kiosk-account' ? (
                    <KioskAccountSection />
                  ) : (() => {
                    const resolvedHref = step.href.replace('{slug}', tenantSlug);
                    const isExternal = resolvedHref.startsWith('http');
                    return (
                      <Link
                        href={resolvedHref as never}
                        target={isExternal ? '_blank' : undefined}
                        rel={isExternal ? 'noopener noreferrer' : undefined}
                        className={cn(
                          'inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition',
                          done
                            ? 'border-2 border-emerald-300 text-emerald-900 hover:bg-emerald-50'
                            : 'bg-zinc-900 text-white hover:bg-zinc-700',
                        )}
                      >
                        {done ? 'Anpassen' : step.todoLabel}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    );
                  })()}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {allDone && (
        <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-100 p-6 text-center">
          <ShoppingBag className="h-12 w-12 text-emerald-700 mx-auto mb-3" />
          <h2 className="font-display text-2xl font-black text-emerald-900 mb-2">
            Glückwunsch! 🎉
          </h2>
          <p className="text-sm text-emerald-900 mb-4">
            Dein Lieferservice ist live. Teile den Link mit deinen Kunden:
          </p>
          <Link
            href={`https://mise-gastro.de/biss-app/${tenantSlug}` as never}
            target="_blank"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-700 text-white font-display font-black hover:bg-emerald-800"
          >
            <Globe className="h-5 w-5" />
            mise-gastro.de/biss-app/{tenantSlug}
          </Link>
        </div>
      )}
    </div>
  );
}
