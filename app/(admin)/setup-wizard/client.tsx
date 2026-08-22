'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight, Banknote, Bike, Boxes, Calculator, Check, ChefHat, CreditCard,
  FolderOpen, Globe, Loader2, Lock, Palette, Percent, Plus, Printer, QrCode,
  Receipt, Rocket, Shield, ShoppingBag, Smartphone, Sparkles, UserPlus, Users,
  Utensils, UtensilsCrossed, Wallet, X, Zap,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

interface Counts {
  categories: number; items: number; employees: number; taxRates: number;
  registers: number; tables: number; stations: number;
}

interface StepStatus {
  menu: boolean; categories: boolean; user: boolean; taxRates: boolean;
  modules: boolean; receipt: boolean; registers: boolean; tse: boolean;
}

interface ModuleFlags {
  qrTisch: boolean; delivery: boolean; kitchen: boolean;
  inventory: boolean; notifications: boolean;
}

interface ModuleSubStatus {
  qrDesign: boolean; qrTische: boolean; qrZahlung: boolean;
  stripe: boolean; tischplan: boolean; kdsStations: boolean;
}

type WizardStepDef = {
  readonly n: number;
  readonly key: 'menu' | 'categories' | 'user' | 'taxRates' | 'modules' | 'receipt' | 'registers' | 'tse';
  readonly title: string;
  readonly icon: typeof UtensilsCrossed;
  readonly where: string;
  readonly paid: boolean;
  readonly paidNote?: string;
};

const STEPS: readonly WizardStepDef[] = [
  { n: 1, key: 'menu',       title: 'Menü & Speisekarte',  icon: UtensilsCrossed, where: '/menu',               paid: false },
  { n: 2, key: 'categories', title: 'Kategorien',           icon: FolderOpen,      where: '/menu',               paid: false },
  { n: 3, key: 'user',       title: 'Erster Nutzer',        icon: UserPlus,        where: '/employees/new',      paid: false },
  { n: 4, key: 'taxRates',   title: 'Steuersätze',          icon: Percent,         where: '/settings/tax-rates', paid: false },
  { n: 5, key: 'modules',    title: 'Module & Add-ons',     icon: Boxes,           where: '/modules',            paid: false },
  { n: 6, key: 'receipt',    title: 'Kassenbon',            icon: Receipt,         where: '/pos/settings#bon',   paid: false },
  { n: 7, key: 'registers',  title: 'Kasse(n) anlegen',     icon: Calculator,      where: '/pos/registers',      paid: true,  paidNote: 'Jede zusätzliche Kasse kostenpflichtig' },
  { n: 8, key: 'tse',        title: 'TSE — Demo oder Live', icon: Shield,          where: '/settings/tse',       paid: true,  paidNote: 'TSE pflichtig für Live-Betrieb' },
];

export function SetupWizardClient(props: {
  tenantId: string; tenantName: string; tenantSlug: string;
  completedAt: string | null; skippedAt: string | null;
  activeStep: number; mode: 'demo' | 'live';
  counts: Counts; stepStatus: StepStatus;
  moduleFlags: ModuleFlags; moduleSubStatus: ModuleSubStatus;
  hasCustomDomain: boolean; domainVerified: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, startTrans] = useTransition();
  const [confirmSkip, setConfirmSkip] = useState(false);
  const [showCompletion, setShowCompletion] = useState(props.completedAt !== null);
  const [currentStep, setCurrentStep] = useState(Math.max(1, Math.min(8, props.activeStep)));
  const [pickedMode, setPickedMode] = useState<'demo' | 'live'>(props.mode);

  const stepStates = STEPS.map((s) => ({
    ...s,
    done: props.stepStatus[s.key as keyof StepStatus],
  }));

  const doneCount = stepStates.filter((s) => s.done).length;
  const allCriticalDone = stepStates.slice(0, 7).every((s) => s.done);

  function persist(updates: Record<string, unknown>) {
    return startTrans(async () => {
      await supabase.from('tenants').update(updates).eq('id', props.tenantId);
      router.refresh();
    });
  }

  function skipWizard() {
    persist({ wizard_skipped_at: new Date().toISOString() });
    setConfirmSkip(false);
  }

  function resumeWizard() {
    persist({ wizard_skipped_at: null });
  }

  function setActive(n: number) {
    setCurrentStep(n);
    persist({ wizard_active_step: n });
  }

  function complete(mode: 'demo' | 'live') {
    persist({
      wizard_completed_at: new Date().toISOString(),
      wizard_mode: mode,
    });
    setShowCompletion(true);
  }

  if (showCompletion) {
    return <CompletionScreen mode={pickedMode} tenantName={props.tenantName} onReopen={() => setShowCompletion(false)} />;
  }

  const skipped = props.skippedAt !== null && !props.completedAt;

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="rounded-3xl bg-gradient-to-br from-matcha-900 to-matcha-700 text-matcha-50 p-6 md:p-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-xl bg-matcha-50/15 grid place-items-center">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="text-xs font-bold uppercase tracking-[0.25em] opacity-80">Setup-Wizard</div>
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-black">
          Hi {props.tenantName} 👋
        </h1>
        <p className="text-matcha-50/85 mt-2 max-w-2xl">
          In ein paar Minuten ist deine Kasse einsatzbereit. Klick dich Schritt für Schritt durch — wir zeigen dir genau wo&apos;s im Backoffice langgeht.
        </p>

        {/* Fortschrittsbalken */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2 text-xs font-bold">
            <span className="opacity-80">Fortschritt</span>
            <span>{doneCount} / 8 Schritte</span>
          </div>
          <div className="h-3 rounded-full bg-matcha-50/15 overflow-hidden">
            <div
              className="h-full bg-gold transition-all duration-500"
              style={{ width: `${(doneCount / 8) * 100}%` }}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-5">
          {skipped ? (
            <button
              onClick={resumeWizard}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-gold text-matcha-900 px-4 py-2 text-sm font-bold hover:bg-gold/90"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
              Wizard fortsetzen
            </button>
          ) : (
            <>
              <button
                onClick={() => setConfirmSkip(true)}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-xl bg-matcha-50/10 hover:bg-matcha-50/20 px-3 py-2 text-xs font-bold"
              >
                Wizard überspringen
              </button>
              {allCriticalDone && (
                <button
                  onClick={() => setShowCompletion(true)}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-xl bg-gold text-matcha-900 px-4 py-2 text-sm font-bold hover:bg-gold/90"
                >
                  Demo / Live wählen <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </>
          )}
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl bg-matcha-50/10 hover:bg-matcha-50/20 px-3 py-2 text-xs font-bold ml-auto"
          >
            Zum Dashboard
          </Link>
        </div>
      </div>

      {/* SKIPPED-Hinweis */}
      {skipped && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900 flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-amber-500 text-white grid place-items-center shrink-0">!</div>
          <span>Wizard wurde am {new Date(props.skippedAt!).toLocaleDateString('de-DE')} übersprungen. Du arbeitest direkt in der Sidebar — das ist OK für Power-User. Klick oben &bdquo;Fortsetzen&ldquo; um zum geführten Setup zurückzukehren.</span>
        </div>
      )}

      {/* STEPS */}
      <div className="space-y-3">
        {stepStates.map((s, idx) => {
          const isActive = !s.done && currentStep === s.n;
          const Icon = s.icon;
          return (
            <StepCard
              key={s.n}
              number={s.n}
              total={STEPS.length}
              icon={Icon}
              title={s.title}
              done={s.done}
              active={isActive}
              paid={s.paid}
              paidNote={s.paidNote}
              path={s.where}
            >
              {/* Step-spezifischer Inhalt */}
              {s.key === 'menu' && (
                <StepBody
                  description="Lege dein Menü an oder übernimm ein bestehendes (Menüs sind modulübergreifend wiederverwendbar — z. B. das gleiche Menü für Lieferung und QR-Tisch)."
                  primary={{ label: props.counts.items === 0 ? 'Menü anlegen' : `${props.counts.items} Artikel bearbeiten`, href: '/menu' }}
                  hint={`Backoffice → Bestellsystem → Speisekarte → Artikel & Preise`}
                />
              )}

              {s.key === 'categories' && (
                <StepBody
                  description="Kategorien gruppieren deine Artikel: Frühstück, Mittag, Getränke, Desserts. Ohne Kategorien wird die Bestellseite unübersichtlich."
                  primary={{ label: props.counts.categories === 0 ? 'Erste Kategorie anlegen' : `${props.counts.categories} Kategorien bearbeiten`, href: '/menu' }}
                  hint={`Im selben Bereich wie Artikel — Tab "Kategorien"`}
                />
              )}

              {s.key === 'user' && (
                <StepBody
                  description="Mindestens ein Mitarbeiter muss angelegt sein damit die Kasse benutzt werden kann. Du selbst bist schon da — leg deine Servicekräfte und Köche an."
                  primary={{ label: props.counts.employees < 2 ? 'Mitarbeiter einladen' : `${props.counts.employees} Mitarbeiter verwalten`, href: '/employees/new' }}
                  hint={`Backoffice → Mitarbeiter → Neuer Mitarbeiter`}
                />
              )}

              {s.key === 'taxRates' && (
                <StepBody
                  description="KRITISCH: Steuersätze müssen korrekt sein. Default 19% / 7%. Sonderregeln möglich pro Artikel — z. B. Kaffee mit ≥ 70% Milch = 7% statt 19%, stilles Wasser je nach Verzehrort."
                  primary={{ label: 'Steuersätze prüfen', href: '/settings/tax-rates' }}
                  hint={`Backoffice → Einstellungen → Steuern · pro Artikel separat im Menü`}
                  badge={`${props.counts.taxRates} Sätze definiert`}
                />
              )}

              {s.key === 'modules' && (
                <ModulesStep
                  flags={props.moduleFlags}
                  sub={props.moduleSubStatus}
                  hasDomain={props.hasCustomDomain}
                  domainOk={props.domainVerified}
                  tenantSlug={props.tenantSlug}
                />
              )}

              {s.key === 'receipt' && (
                <StepBody
                  description="Wie sieht der Bon aus, den der Gast bekommt? Logo, Kopfzeile, Fußzeile, Trinkgeld-Stufen. Auch: Bondrucker / E-Mail / QR — was ist Standard?"
                  primary={{ label: 'Bon-Layout einstellen', href: '/pos/settings' }}
                  hint={`Backoffice → POS-Einstellungen → Bondrucker + Bon-Output`}
                />
              )}

              {s.key === 'registers' && (
                <StepBody
                  description="Mindestens 1 Kasse anlegen. Mehrere Kassen = parallele Schichten (z. B. Theke + Eis-Counter). Jede Kasse bekommt einen Pairing-Code für ein Tablet."
                  primary={{ label: props.counts.registers === 0 ? 'Erste Kasse anlegen' : `${props.counts.registers} Kasse${props.counts.registers === 1 ? '' : 'n'} verwalten`, href: '/pos/registers' }}
                  hint={`Backoffice → Kasse & Finanzen → Kassen / Terminals`}
                />
              )}

              {s.key === 'tse' && (
                <TseStep
                  mode={pickedMode}
                  onPick={(m) => setPickedMode(m)}
                />
              )}

              {/* Footer-Buttons */}
              {!s.done && isActive && (
                <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
                  <button
                    onClick={() => setActive(s.n + 1)}
                    disabled={busy || s.n === 8}
                    className="inline-flex items-center gap-2 rounded-xl bg-matcha-900 text-matcha-50 px-4 py-2 text-sm font-bold hover:bg-matcha-800 disabled:opacity-50"
                  >
                    Schritt erledigt — weiter <ArrowRight className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setActive(s.n + 1)}
                    disabled={busy || s.n === 8}
                    className="inline-flex items-center gap-2 rounded-xl bg-white border-2 border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 text-sm font-bold disabled:opacity-50"
                  >
                    Später erinnern
                  </button>
                </div>
              )}
              {!isActive && !s.done && (
                <div className="mt-3">
                  <button
                    onClick={() => setActive(s.n)}
                    className="text-xs font-bold text-matcha-900 hover:underline"
                  >
                    → Auf diesen Schritt springen
                  </button>
                </div>
              )}
            </StepCard>
          );
        })}
      </div>

      {/* CONFIRM-SKIP-MODAL */}
      {confirmSkip && (
        <div className="fixed inset-0 z-[60] bg-black/80 grid items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-display text-xl font-black">Wizard wirklich überspringen?</h3>
            <p className="text-sm text-gray-700 leading-relaxed">
              Du landest direkt im Dashboard und kannst alles über die Sidebar erreichen. Den Wizard kannst du jederzeit über &bdquo;Setup-Wizard&ldquo; in der Sidebar wieder aufrufen.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmSkip(false)}
                className="flex-1 py-3 rounded-xl border border-gray-300 font-bold"
              >
                Doch nicht
              </button>
              <button
                onClick={skipWizard}
                disabled={busy}
                className="flex-1 py-3 rounded-xl bg-matcha-900 text-matcha-50 font-bold hover:bg-matcha-800 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Überspringen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===========================================================================
   STEP-CARD (Container)
   ======================================================================== */
function StepCard({
  number, total, icon: Icon, title, done, active, paid, paidNote, path, children,
}: {
  number: number; total: number;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  done: boolean; active: boolean;
  paid?: boolean; paidNote?: string;
  path: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(
      'bg-white rounded-2xl border-2 p-5 transition',
      done ? 'border-emerald-200 bg-emerald-50/30' :
      active ? 'border-matcha-700 shadow-md' :
      'border-gray-200',
    )}>
      <div className="flex items-start gap-4">
        <div className={cn(
          'h-12 w-12 rounded-2xl grid place-items-center shrink-0 font-display font-black text-lg',
          done ? 'bg-emerald-500 text-white' :
          active ? 'bg-matcha-900 text-matcha-50' :
          'bg-gray-100 text-gray-500',
        )}>
          {done ? <Check className="h-6 w-6" strokeWidth={3} /> : number}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Icon className="h-4 w-4 text-gray-500 shrink-0" />
            <h3 className="font-bold text-lg">{title}</h3>
            {done && <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">Erledigt</span>}
            {paid && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded inline-flex items-center gap-1" title={paidNote}>
                💶 Kostenhinweis
              </span>
            )}
            <span className="text-[10px] font-mono text-gray-400 ml-auto">Schritt {number} / {total}</span>
          </div>
          <div className="text-[11px] font-mono text-gray-500 mt-0.5">📍 Im Backoffice: {path}</div>
          <div className="mt-3">{children}</div>
          {paid && paidNote && (
            <div className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
              {paidNote}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ===========================================================================
   STEP-BODY (einfach: Beschreibung + 1 Primary-Button + Hint)
   ======================================================================== */
function StepBody({
  description, primary, hint, badge,
}: {
  description: string;
  primary: { label: string; href: string };
  hint?: string;
  badge?: string;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-700 leading-relaxed">{description}</p>
      {badge && (
        <div className="inline-flex items-center gap-1 text-xs font-bold text-matcha-900 bg-matcha-50 border border-matcha-200 rounded-full px-2 py-0.5">
          {badge}
        </div>
      )}
      <Link
        href={primary.href}
        className="inline-flex items-center gap-2 rounded-xl bg-white border-2 border-matcha-900 text-matcha-900 hover:bg-matcha-50 px-4 py-2 text-sm font-bold"
      >
        {primary.label} <ArrowRight className="h-4 w-4" />
      </Link>
      {hint && <div className="text-xs text-gray-500">💡 {hint}</div>}
    </div>
  );
}

/* ===========================================================================
   STEP 5: Module/Add-ons (sub-cards je nach gebuchten Modulen)
   ======================================================================== */
function ModulesStep({ flags, sub, hasDomain, domainOk, tenantSlug }: {
  flags: ModuleFlags; sub: ModuleSubStatus;
  hasDomain: boolean; domainOk: boolean;
  tenantSlug: string;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-700 leading-relaxed">
        Hier konfigurierst du jedes gebuchte Add-on einzeln. Was du nicht gebucht hast, erscheint nicht.
      </p>
      <div className="grid gap-2 mt-3">
        {flags.qrTisch && (
          <ModuleSubCard
            icon={QrCode}
            title="QR-Tisch-Bestellsystem"
            done={sub.qrTische && sub.qrDesign && sub.qrZahlung}
            items={[
              { label: 'Tische angelegt', done: sub.qrTische },
              { label: 'Design angepasst (Logo + Banner)', done: sub.qrDesign },
              { label: 'Zahlungsart hinterlegt', done: sub.qrZahlung },
            ]}
            link={{ label: 'Komplett-Setup öffnen', href: '/qr-bestellsystem' }}
          />
        )}
        <ModuleSubCard
          icon={Wallet}
          title="Stripe — Online-Zahlung"
          done={sub.stripe}
          items={[{ label: 'Stripe Connect aktiv', done: sub.stripe }]}
          link={{ label: sub.stripe ? 'Stripe verwalten' : 'Stripe verbinden', href: '/settings/stripe' }}
        />
        <ModuleSubCard
          icon={Globe}
          title="Eigene Domain (optional)"
          done={domainOk}
          items={[{ label: hasDomain ? (domainOk ? 'Verifiziert' : 'Pending DNS') : 'Subdomain reicht erstmal', done: domainOk }]}
          link={{ label: hasDomain ? 'Domain verwalten' : 'Domain verbinden', href: '/settings/domain' }}
        />
        <ModuleSubCard
          icon={ShoppingBag}
          title="Tische / Tischplan"
          done={sub.tischplan}
          items={[
            { label: 'Tische angelegt', done: sub.tischplan },
            { label: 'Floor-Plan platziert (optional)', done: sub.tischplan },
          ]}
          link={{ label: 'Tischplan zeichnen', href: '/pos/tables/layout' }}
        />
        {flags.kitchen && (
          <ModuleSubCard
            icon={ChefHat}
            title="KDS — Küchen-Display"
            done={sub.kdsStations}
            items={[
              { label: 'Stationen angelegt (Pizza, Bar, …)', done: sub.kdsStations },
              { label: 'Routing pro Kategorie', done: sub.kdsStations },
            ]}
            link={{ label: 'KDS einrichten', href: '/pos/stations' }}
          />
        )}
        {flags.delivery && (
          <ModuleSubCard
            icon={Bike}
            title="Lieferdienst-Modul"
            done={false}
            items={[{ label: 'Bestellungen erscheinen automatisch in der Kasse', done: true }]}
            link={{ label: 'Lieferdienst öffnen', href: '/dispatch' }}
          />
        )}
        {flags.inventory && (
          <ModuleSubCard
            icon={Boxes}
            title="Lieferantenmodul / Lager"
            done={false}
            items={[{ label: 'Lieferantenansicht in der Kasse verknüpft', done: true }]}
            link={{ label: 'Lager öffnen', href: '/inventory' }}
          />
        )}
      </div>
    </div>
  );
}

function ModuleSubCard({ icon: Icon, title, done, items, link }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string; done: boolean;
  items: { label: string; done: boolean }[];
  link: { label: string; href: string };
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-white border border-gray-200 hover:border-matcha-700 transition">
      <div className={cn(
        'h-9 w-9 rounded-lg grid place-items-center shrink-0',
        done ? 'bg-emerald-100 text-emerald-700' : 'bg-matcha-50 text-matcha-900',
      )}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-bold text-sm">{title}</h4>
          {done && <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">OK</span>}
        </div>
        <ul className="mt-1 space-y-0.5">
          {items.map((it, i) => (
            <li key={i} className="text-xs text-gray-600 flex items-center gap-1.5">
              <span className={cn('h-3 w-3 rounded-full grid place-items-center shrink-0', it.done ? 'bg-emerald-500' : 'bg-gray-300')}>
                {it.done && <Check className="h-2 w-2 text-white" strokeWidth={4} />}
              </span>
              {it.label}
            </li>
          ))}
        </ul>
      </div>
      <Link href={link.href} className="text-xs font-bold text-matcha-900 hover:underline shrink-0 mt-1">
        {link.label} →
      </Link>
    </div>
  );
}

/* ===========================================================================
   STEP 8: TSE — Demo vs. Live
   ======================================================================== */
function TseStep({ mode, onPick }: { mode: 'demo' | 'live'; onPick: (m: 'demo' | 'live') => void }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-700 leading-relaxed">
        TSE = Technische Sicherheits-Einrichtung. Pflicht für den Live-Betrieb in Deutschland. Du wählst hier ob du mit Demo startest (Test, ohne TSE) oder direkt Live mit TSE pro Kasse.
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        <button
          onClick={() => onPick('demo')}
          className={cn(
            'text-left p-4 rounded-2xl border-2 transition',
            mode === 'demo' ? 'border-matcha-700 bg-matcha-50' : 'border-gray-200 hover:border-gray-300',
          )}
        >
          <div className="flex items-center gap-2 mb-1">
            <div className={cn('h-8 w-8 rounded-lg grid place-items-center', mode === 'demo' ? 'bg-matcha-700 text-white' : 'bg-gray-100 text-gray-500')}>
              <Zap className="h-4 w-4" />
            </div>
            <h4 className="font-bold">Demo / Test</h4>
            {mode === 'demo' && <Check className="h-4 w-4 text-matcha-700 ml-auto" />}
          </div>
          <p className="text-xs text-gray-700">Keine echte Buchhaltung. Ideal zum Ausprobieren mit dem ganzen Team. TSE nicht erforderlich.</p>
        </button>
        <button
          onClick={() => onPick('live')}
          className={cn(
            'text-left p-4 rounded-2xl border-2 transition',
            mode === 'live' ? 'border-matcha-700 bg-matcha-50' : 'border-gray-200 hover:border-gray-300',
          )}
        >
          <div className="flex items-center gap-2 mb-1">
            <div className={cn('h-8 w-8 rounded-lg grid place-items-center', mode === 'live' ? 'bg-matcha-700 text-white' : 'bg-gray-100 text-gray-500')}>
              <Shield className="h-4 w-4" />
            </div>
            <h4 className="font-bold">Live-Betrieb</h4>
            {mode === 'live' && <Check className="h-4 w-4 text-matcha-700 ml-auto" />}
          </div>
          <p className="text-xs text-gray-700">Echte Bestellungen, GoBD-konform. TSE muss pro Kasse aktiviert werden — kostenpflichtig.</p>
        </button>
      </div>
    </div>
  );
}

/* ===========================================================================
   COMPLETION-Screen — Demo/Live + Kassen-App-Download
   ======================================================================== */
function CompletionScreen({ mode, tenantName, onReopen }: {
  mode: 'demo' | 'live'; tenantName: string; onReopen: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-br from-emerald-600 to-emerald-800 text-white p-8 text-center">
        <div className="h-20 w-20 rounded-full bg-white/15 grid place-items-center mx-auto mb-4">
          <Check className="h-10 w-10" strokeWidth={3} />
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-black">Setup abgeschlossen</h1>
        <p className="text-white/90 mt-2 max-w-xl mx-auto">
          {tenantName} ist {mode === 'demo' ? 'im Demo-Betrieb' : 'live'}. Alle gebuchten Module sind verbunden.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/15 text-sm font-bold">
          {mode === 'demo' ? <><Zap className="h-4 w-4" /> Demo-Modus aktiv</> : <><Shield className="h-4 w-4" /> Live-Modus · TSE pro Kasse aktivieren</>}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border p-5">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Smartphone className="h-5 w-5" /> Kassen-App fürs Tablet
          </h3>
          <p className="text-sm text-gray-600 mt-2">Lade die Mise-POS-App auf dein iPad oder Android-Tablet.</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="aspect-square bg-gray-100 rounded-2xl grid place-items-center text-gray-400">
              <div className="text-center">
                <QrCode className="h-12 w-12 mx-auto" />
                <div className="text-[10px] font-bold mt-1">App Store QR</div>
                <div className="text-[9px]">(folgt nach Submit)</div>
              </div>
            </div>
            <div className="aspect-square bg-gray-100 rounded-2xl grid place-items-center text-gray-400">
              <div className="text-center">
                <QrCode className="h-12 w-12 mx-auto" />
                <div className="text-[10px] font-bold mt-1">Play Store QR</div>
                <div className="text-[9px]">(folgt nach Submit)</div>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-gray-500 mt-2">App ist in Apple-Review — sobald freigegeben erscheint hier der echte Download-QR.</p>
        </div>

        <div className="bg-white rounded-2xl border p-5">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5" /> Was jetzt?
          </h3>
          <ul className="mt-3 space-y-2 text-sm text-gray-700">
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
              <span>Alle Module verbunden, Bestellungen laufen automatisch in Kasse + KDS</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
              <span>QR-Codes drucken & auf Tische kleben</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
              <span>Mitarbeiter einloggen lassen</span>
            </li>
            {mode === 'live' && (
              <li className="flex items-start gap-2 text-amber-800">
                <Shield className="h-4 w-4 mt-0.5 shrink-0" />
                <span><strong>Live-Modus:</strong> TSE pro Kasse aktivieren bevor erste echte Bestellung läuft</span>
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/" className="inline-flex items-center gap-2 rounded-xl bg-matcha-900 text-matcha-50 px-4 py-2 text-sm font-bold hover:bg-matcha-800">
          Zum Dashboard <ArrowRight className="h-4 w-4" />
        </Link>
        <Link href="/pos/terminal" className="inline-flex items-center gap-2 rounded-xl bg-white border-2 border-matcha-900 text-matcha-900 hover:bg-matcha-50 px-4 py-2 text-sm font-bold">
          Kasse vorne öffnen
        </Link>
        <button onClick={onReopen} className="inline-flex items-center gap-2 rounded-xl bg-white border-2 border-gray-200 text-gray-600 hover:bg-gray-50 px-4 py-2 text-sm font-bold ml-auto">
          Wizard nochmal öffnen
        </button>
      </div>
    </div>
  );
}
