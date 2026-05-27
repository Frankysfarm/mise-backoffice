import Link from 'next/link';
import {
  ArrowRight, Banknote, Bike, BookOpen, Calculator, Calendar, ChefHat, Check, ChevronRight,
  CheckSquare, Clock, CreditCard, Flame, GraduationCap, MessageSquare, Package, Plug, Receipt,
  Shield, ShoppingBag, Sparkles, Star, Store, Ticket, TrendingUp, Truck, UtensilsCrossed, Users, X, Zap,
} from 'lucide-react';
import { Reveal } from './components/reveal';
import { CountUp } from './components/count-up';
import { ModulesMenu } from './components/modules-menu';
import { MobileNav } from './components/mobile-nav';
import { LangSwitcher } from './components/lang-switcher';
import { Typewriter, ParallaxBlob, ScrollProgress } from './components/animations';
import { HeroCTA } from './components/hero-cta';
import {
  AnalyticsDemo, CheckupDemo, CleaningDemo, DeliveryDemo, InventoryDemo, KitchenDemo,
  NotificationsDemo, OrderingDemo, PlatformsDemo, PosDemo, ScheduleDemo, TrainingDemo,
} from './components/module-demos';

export const metadata = {
  title: 'Mise — Das Betriebssystem für dein Restaurant',
  description:
    'Dienstplan, Lager, Online-Shop, Kasse, Lieferung, Lieferando-Anschluss — alles in einem System. 14 Tage alle Module gratis.',
};

export default function WelcomePage() {
  return (
    <div className="bg-surface text-matcha-900 overflow-x-hidden">
      <ScrollProgress />
      {/* ==================== NAV ==================== */}
      <Nav />

      {/* ==================== HERO ==================== */}
      <section className="relative overflow-hidden bg-matcha-900 text-white">
        <ParallaxBlob className="pointer-events-none absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-accent opacity-10 blur-3xl" strength={60} />
        <ParallaxBlob className="pointer-events-none absolute top-1/2 -left-40 h-[400px] w-[400px] rounded-full bg-gold opacity-10 blur-3xl" strength={40} />

        <div className="container relative z-10 pt-28 pb-24 md:pt-32 md:pb-32">
          {/* Großes Wordmark über Headline */}
          <Reveal>
            <div className="flex items-center gap-4 mb-6">
              <Logo />
              <div className="h-8 w-px bg-matcha-300/30" />
              <div className="text-[11px] md:text-sm font-bold uppercase tracking-[0.25em] text-accent">
                Das Betriebssystem<br className="sm:hidden" />
                <span className="hidden sm:inline"> · </span>für dein Restaurant
              </div>
            </div>
          </Reveal>
          <Reveal delay={40}>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wider backdrop-blur">
              <Sparkles className="h-3 w-3" />
              14 Tage alle Module gratis
              <span className="opacity-40">·</span>
              <span className="opacity-80">Keine Kreditkarte. Keine Bindung.</span>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="mt-6 font-display text-5xl md:text-7xl font-bold tracking-[-0.02em] leading-[0.95] max-w-4xl">
              <Typewriter
                text="Ein System."
                accentText="Dein ganzes Restaurant."
                accentClass="text-accent"
                speed={40}
                startDelay={350}
              />
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="mt-6 text-lg md:text-xl text-matcha-100 max-w-2xl leading-relaxed">
              Dienstplan, Bestellseite, Kasse, Küche, Fahrer, Lieferando-Anschluss —
              alles greift ineinander. <strong className="text-white">Schluss mit 6 Tablets am Tresen.</strong>{" "}
              Schluss mit 4 Logins. Schluss mit Excel um 23:30.
            </p>
          </Reveal>
          <Reveal delay={200}>
            <p className="mt-2 text-sm text-matcha-300">
              Vom Profi für Profis. Gemacht mit Wirten, getestet im Doppelschicht-Stress.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <HeroCTA label="14 Tage gratis testen" href="/signup" />
              <Link
                href="#module"
                className="inline-flex h-14 items-center gap-2 text-matcha-100 hover:text-white font-semibold"
              >
                Alle Module ansehen <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>

          <Reveal delay={320}>
            <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-6">
              <Stat value={40} prefix="−" suffix=" %" label="Wartezeit am Tresen" />
              <Stat value={12} suffix=" %" label="mehr Umsatz pro Schicht" />
              <Stat value={2} suffix=" %" label="Fee auf Online-Zahlungen" />
              <Stat value={0} suffix=" €" label="Setup. Keine Bindung." />
            </div>
          </Reveal>
        </div>

        {/* Scroll-Hint */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-matcha-300/60 text-xs">
          <div>scroll</div>
          <div className="h-8 w-[1px] bg-matcha-300/30 animate-pulse" />
        </div>
      </section>

      {/* ==================== PAIN ==================== */}
      <section className="bg-white py-24">
        <div className="container">
          <Reveal>
            <div className="text-center max-w-3xl mx-auto">
              <div className="text-xs font-bold uppercase tracking-[0.3em] text-matcha-700 mb-3">Das Problem</div>
              <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
                Kennst du das?
              </h2>
            </div>
          </Reveal>

          <div className="mt-14 grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              { icon: '📱', title: 'Tablet-Chaos', text: 'Lieferando, Wolt, Uber, Küche — vier Tablets, alle ungeladen. Orders gehen verloren, Personal flippt aus, Kunden warten 50 Minuten.' },
              { icon: '📊', title: 'Bauchgefühl-Buchhaltung', text: 'Am Monatsende sortierst du Quittungen. Welcher Tag war profitabel? Welches Item bringt Marge? Du tippst ins Blaue.' },
              { icon: '📋', title: 'Zettelwirtschaft', text: 'Dienstplan auf Papier. HACCP in Excel. Trinkgeld auf Bierdeckel. Einer kündigt — drei Wochen Wissen weg.' },
            ].map((c, i) => (
              <Reveal key={i} delay={i * 100}>
                <div className="rounded-2xl border-2 border-dashed border-red-200 bg-red-50/50 p-6">
                  <div className="text-4xl mb-3">{c.icon}</div>
                  <div className="font-display text-lg font-bold">{c.title}</div>
                  <p className="mt-2 text-sm text-muted-foreground">{c.text}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={300}>
            <div className="mt-14 flex items-center justify-center gap-2 text-2xl md:text-3xl font-display font-bold tracking-tight">
              <span className="text-muted-foreground">Du verlierst</span>
              <span className="rounded-xl bg-matcha-900 text-matcha-50 px-4 py-1">
                <CountUp end={45} suffix=" Min" /> pro Tag
              </span>
              <span className="text-muted-foreground">im Admin-Chaos</span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ==================== SOLUTION HEADER ==================== */}
      <section className="bg-matcha-50 py-24">
        <div className="container text-center max-w-3xl mx-auto">
          <Reveal>
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.3em] text-matcha-700 mb-3">
              <Sparkles className="h-3 w-3" /> Die Lösung
            </div>
            <h2 className="font-display text-4xl md:text-6xl font-bold tracking-[-0.02em]">
              Ein <span className="text-matcha-700">System.</span>
              <br />
              Alles drin.
            </h2>
            <p className="mt-6 text-lg text-muted-foreground">
              Mise ist kein Tool. Mise ist die Maschine die hinter deinem
              Restaurant läuft. Modular gebucht, transparent berechnet,
              14 Tage komplett gratis testen.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ==================== MODULES ==================== */}
      <section id="module" className="bg-white">
        <ModuleSection
          slug="dienstplan"
          badge="Team"
          icon="📅"
          title="Dienstplan, der das Arbeitsrecht kennt."
          subtitle="Verfügbarkeiten fließen live ein. Jedes Drag-and-Drop prüft 11h-Ruhezeit und Max-Stunden. Kein Risiko bei Kontrollen."
          benefits={[
            'Wochenplan in 10 Min statt 2 Stunden',
            'ArbZG §3 + §5 Validator live beim Planen',
            'Mitarbeiter tauschen Schichten selbst in der App',
            'Krankmeldung morgens → System schlägt Ersatz vor',
          ]}
          demo={<ScheduleDemo />}
          stat={{ value: 82, suffix: '%', label: 'weniger Planungszeit' }}
        />

        <ModuleSection
          slug="lager"
          reverse
          tint="beige"
          badge="Lager"
          icon="📦"
          title="Lager-Engpässe? Vorbei."
          subtitle="Par-Level-Alerts. FIFO-Chargen mit MHD. Schwund pro Artikel. Drei Lieferanten im Direkt-Vergleich. Du bestellst wann es nötig ist — nicht wenn der Koch panisch anruft."
          benefits={[
            'Par-Level unterschritten → Push-Alert + Reorder-Vorschlag',
            'FIFO-Tracking: älteste Charge zuerst raus',
            'Schwund-Top-5 pro Monat — keine 200€ Bananen mehr in der Tonne',
            'Preis-Historie pro Lieferant für bessere Verhandlungen',
          ]}
          demo={<InventoryDemo />}
          stat={{ value: 37, suffix: '%', label: 'weniger Schwund im ersten Quartal' }}
        />

        <ModuleSection
          slug="bestellseite"
          badge="Umsatz"
          icon="🛒"
          title="Deine eigene Bestellseite. Keine 30 % Provision."
          subtitle="Lieferando nimmt 14 %. Uber 30 %. Wolt 25 %. Deine eigene Seite: 2 % Stripe-Fee. Den Rest behältst du."
          benefits={[
            'Eigene URL mit deinem Branding: mise.app/order/dein-laden',
            'Stripe Connect in 3 Min → Zahlungen direkt auf dein Konto',
            'Adress-Autocomplete (OSM) + Lieferradius-Check',
            'Gutschein-Codes direkt im Checkout einlösbar',
          ]}
          demo={<OrderingDemo />}
          stat={{ value: 28, suffix: '%', label: 'Marge gespart gegenüber Drittanbietern' }}
        />

        <ModuleSection
          slug="kueche"
          reverse
          tint="beige"
          badge="Küche"
          icon="👨‍🍳"
          title="Jedes Ticket. Jede Sekunde. Eine Farbe sagt alles."
          subtitle="Shop + Lieferando + Uber + Kasse — alles in einem Display. Timer mit Auto-Eskalation, Allergene rot. Und: die Küche weiß wann der Fahrer zurück ist."
          benefits={[
            '4 Spalten, 4 Quellen, ein Display',
            'Allergen-Warnung rot markiert — nie übersehen',
            'Sound-Alert + Blinken bei Überziehen',
            'Retour-Timing: System startet nächste Liefer-Order wenn Fahrer in 5 Min zurück ist',
          ]}
          demo={<KitchenDemo />}
          stat={{ value: 43, suffix: '%', label: 'schnellere Ticket-Time im Schnitt' }}
        />

        <ModuleSection
          slug="lieferung"
          badge="Lieferung"
          icon="🛵"
          title="Jede Fahrt optimiert. Automatisch."
          subtitle="Das System clustert Bestellungen nach Strecke → weniger Kilometer, weniger Sprit. Erkennt die Retour-Ankunft deines Fahrers → Küche startet den nächsten Auftrag perfekt getimed."
          benefits={[
            'Auto-Route: 2+ Orders in 600 m → eine Tour, optimierte Reihenfolge',
            'Retour-Erkennung: GPS < 200 m zur Filiale → Küche bekommt „Mira in 3 Min zurück"',
            'Live-GPS-Tracking für den Kunden (ohne App)',
            'Bar/Karte-Zahlung → automatisch POS-Bon mit order_id',
          ]}
          demo={<DeliveryDemo />}
          stat={{ value: 23, prefix: '−', suffix: '%', label: 'weniger Kilometer · spart Sprit' }}
        />

        <ModuleSection
          slug="analytics"
          reverse
          tint="beige"
          badge="Analytics"
          icon="📊"
          title="Zahlen die zählen. Statt Bauchgefühl."
          subtitle="Umsatz pro Tag, Top-Seller, Food-Cost-Marge, Trinkgeld pro Schicht. Live aus Kasse + Shop + Lieferung. Kein Excel-Sonntagabend mehr."
          benefits={[
            'Tagesumsatz live',
            'Monatsvergleich mit einem Klick',
            'Top-5-Schwund automatisch erkannt',
            'Z-Bericht GoBD-konform druckbar',
          ]}
          demo={<AnalyticsDemo />}
          stat={{ value: 3, prefix: '+', suffix: ' Std', label: 'pro Woche für echte Management-Arbeit' }}
        />

        <ModuleSection
          slug="plattformen"
          badge="Integrationen"
          icon="🔌"
          title="Lieferando, Uber Eats, Wolt — alles in einem Posteingang."
          subtitle="Du bekommst alle Bestellungen — egal von welcher Plattform — in dein Küchen-Display. Nie wieder Tablet-Hopping."
          benefits={[
            'Webhook-URLs pro Plattform · 1 Klick Aktivierung',
            'Generisches Format (Deliverect/Otter-kompatibel)',
            'Auto-Mapping von externen Store-IDs',
            'Test-Ping-Button fürs Debug',
          ]}
          demo={<PlatformsDemo />}
          stat={{ value: 4, suffix: ' Plattformen', label: 'in einem Küchen-Monitor vereint' }}
        />

        <ModuleSection
          slug="reinigung"
          reverse
          tint="beige"
          badge="Hygiene"
          icon="✨"
          title="Reinigung mit Foto-Nachweis."
          subtitle="Jede Zone, jede Schicht, jeder Abwasch dokumentiert. HACCP-Pflicht erfüllt — automatisch."
          benefits={[
            '6 Zonen × 3 Tagesphasen, vordefinierte Tasks',
            'Foto-Pflicht pro Zone vorm Abhaken',
            'HACCP-PDF auf Knopfdruck für Lebensmittelkontrolle',
            'Reminder wenn Zone zu lange offen ist',
          ]}
          demo={<CleaningDemo />}
          stat={{ value: 100, suffix: '%', label: 'Hygiene-Check-Quote seit Einführung' }}
        />

        <ModuleSection
          slug="check-ups"
          badge="Check-ups"
          icon="📋"
          title="Der Morgen-Check. In 3 Minuten durch."
          subtitle="Kühltemperaturen, Seife, Sauberkeit — Foto-Checklisten, die jeder versteht. Auto-Eskalation wenn was fehlt."
          benefits={[
            'Templates: Morgen, Mittag, Feierabend',
            'Foto-Pflicht für kritische Punkte',
            'Session-Locking: erst Ausfüllen, dann abschließen',
            'Bei Abweichung: automatische Nachricht an Schicht-Leiter',
          ]}
          demo={<CheckupDemo />}
          stat={{ value: 73, suffix: '%', label: 'weniger Beanstandungen bei Kontrollen' }}
        />

        <ModuleSection
          slug="training"
          reverse
          tint="beige"
          badge="Training"
          icon="🎓"
          title="Neue Leute sind am Tag 2 produktiv."
          subtitle="Lernkarten, Quiz, Badges. Auffrischungs-Reminder. Auch mit AI-Modul-Generator, wenn du keine Lust hast Texte zu schreiben."
          benefits={[
            'Pflichtmodule bei Onboarding automatisch zugewiesen',
            'Quiz mit sofortigem Feedback',
            'Badges & Punkte-System für Gamification',
            'AI generiert neue Module aus deinen Bullet-Points',
          ]}
          demo={<TrainingDemo />}
          stat={{ value: 50, suffix: '%', label: 'kürzere Einarbeitung neuer Mitarbeiter' }}
        />

        <ModuleSection
          slug="kasse"
          badge="Kasse"
          icon="💰"
          title="Eine Kasse. Alle Kanäle. GoBD-fest."
          subtitle="iPad-Terminal mit SumUp-Reader. Online-Orders direkt im Pickup-Panel. Z-Bon + DSFinV-K-Export per Klick. TSE-ready. Steuerprüfer können kommen."
          benefits={[
            'Produkt-Grid mit Beliebt-Sektion',
            'Offene Online-Bestellungen im Panel direkt kassieren',
            'Bar, Karte, digital · automatische MwSt-Aufteilung',
            'Z-Bericht mit Ist-Zählung + druckbar',
          ]}
          demo={<PosDemo />}
          stat={{ value: 8, suffix: ' Min', label: 'schnellerer Tagesabschluss gegenüber Tillhub' }}
        />

        <ModuleSection
          slug="benachrichtigungen"
          reverse
          tint="beige"
          badge="Notifications"
          icon="🔔"
          title="Nichts geht mehr unter."
          subtitle="Zeugnis läuft ab · Schicht fehlt · Bestellung dringend · Kassenabschluss abgeschickt. Alles in einem Feed."
          benefits={[
            '15 Event-Typen vordefiniert',
            'Rollenbasiert: Manager sieht anderes als Fahrer',
            'Push-Notifications an Fahrer-App',
            'Regel-Editor für eigene Alerts',
          ]}
          demo={<NotificationsDemo />}
          stat={{ value: 0, prefix: '', suffix: '', label: 'vergessene Dokumente seit Aktivierung' }}
        />

        {/* Mini-Grid für die 2 letzten (Gutscheine + Dokumente) */}
        <div className="bg-white py-20 border-t">
          <div className="container">
            <Reveal>
              <div className="text-center max-w-3xl mx-auto mb-10">
                <div className="text-xs font-bold uppercase tracking-[0.3em] text-matcha-700 mb-3">
                  + Bonus
                </div>
                <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight">
                  Und Kleinigkeiten, die den Unterschied machen.
                </h2>
              </div>
            </Reveal>
            <div className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto">
              {[
                { icon: '🎟️', name: 'Gutscheine & QR-Rabatte', desc: 'WELCOME10-Codes für Marketing · automatische QR-Folgegutscheine auf jedem Kassenbon.' },
                { icon: '📄', name: 'Dokumente & Ablauf-Ampel', desc: 'Gesundheitszeugnisse, Arbeitsverträge, Allergen-Listen — mit Ablauf-Warnung 30/14/3 Tage vorher.' },
              ].map((m, i) => (
                <Reveal key={i} delay={i * 80}>
                  <div className="rounded-2xl border bg-card p-6 hover:shadow-soft transition">
                    <div className="text-4xl">{m.icon}</div>
                    <div className="mt-3 font-display text-lg font-bold">{m.name}</div>
                    <p className="mt-1 text-sm text-muted-foreground">{m.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ==================== COMPARISON ==================== */}
      <section className="bg-matcha-900 text-white py-24">
        <div className="container">
          <Reveal>
            <div className="text-center max-w-3xl mx-auto">
              <div className="text-xs font-bold uppercase tracking-[0.3em] text-accent mb-3">Davor vs. Danach</div>
              <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
                Was du <span className="text-accent italic">sparst</span>.
              </h2>
            </div>
          </Reveal>

          <div className="mt-14 grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {/* Davor */}
            <Reveal>
              <div className="rounded-3xl bg-red-950/40 border border-red-500/20 p-6 md:p-8">
                <div className="flex items-center gap-2 text-red-300 font-bold uppercase tracking-wider text-xs mb-4">
                  <X className="h-4 w-4" /> Klassisches Setup
                </div>
                <div className="space-y-3 text-sm">
                  <ComparisonRow label="Lieferando-Tablet" price="79 €/Monat" bad />
                  <ComparisonRow label="Uber-Eats-Tablet" price="79 €/Monat" bad />
                  <ComparisonRow label="Dienstplan-Tool (Dienstonline)" price="79 €/Monat" bad />
                  <ComparisonRow label="Kassensystem (Tillhub)" price="89 €/Monat" bad />
                  <ComparisonRow label="Fahrer-App (Urbantz)" price="149 €/Monat" bad />
                  <ComparisonRow label="Shop-Plugin (Shopify)" price="39 €/Monat" bad />
                  <ComparisonRow label="Analytics-Tool" price="49 €/Monat" bad />
                </div>
                <div className="mt-6 pt-4 border-t border-red-500/20 flex justify-between items-center">
                  <div className="text-red-200">Pro Monat</div>
                  <div className="font-display text-3xl font-bold text-red-200">563 €</div>
                </div>
                <div className="mt-2 text-xs text-red-300/80">+ 15–30% Provision an Lieferdienste</div>
              </div>
            </Reveal>

            {/* Danach */}
            <Reveal delay={120}>
              <div className="rounded-3xl bg-accent/10 border-2 border-accent p-6 md:p-8 relative">
                <div className="absolute -top-3 right-6 rounded-full bg-accent text-matcha-900 px-3 py-1 text-[10px] font-bold uppercase tracking-wider">
                  Empfohlen
                </div>
                <div className="flex items-center gap-2 text-accent font-bold uppercase tracking-wider text-xs mb-4">
                  <Check className="h-4 w-4" /> Mit Mise
                </div>
                <div className="space-y-3 text-sm">
                  <ComparisonRow label="Alle 12 Module inklusive" price="159 €/Monat" good />
                  <ComparisonRow label="Unbegrenzt Mitarbeiter" price="" good />
                  <ComparisonRow label="Unbegrenzt Bestellungen" price="" good />
                  <ComparisonRow label="Eigene Bestellseite (keine Provision)" price="" good />
                  <ComparisonRow label="Alle Liefer-Plattformen angebunden" price="" good />
                  <ComparisonRow label="14 Tage komplett gratis testen" price="" good />
                  <ComparisonRow label="Keine Vertragsbindung" price="" good />
                </div>
                <div className="mt-6 pt-4 border-t border-accent/30 flex justify-between items-center">
                  <div className="text-matcha-100">Pro Monat</div>
                  <div className="font-display text-3xl font-bold text-accent">
                    <CountUp end={159} prefix="" suffix=" €" />
                  </div>
                </div>
                <div className="mt-2 text-xs text-matcha-200">Nur 2% Fee auf Online-Zahlungen · keine Provision sonst</div>
              </div>
            </Reveal>
          </div>

          <Reveal delay={200}>
            <div className="mt-12 text-center">
              <div className="font-display text-3xl md:text-4xl font-bold">
                <span className="text-matcha-100">Du sparst </span>
                <span className="text-accent">
                  <CountUp end={4848} prefix="" suffix=" €" /> im Jahr
                </span>
              </div>
              <div className="mt-1 text-matcha-300 text-sm">Ohne Plattform-Provisionen sogar noch deutlich mehr.</div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ==================== TESTIMONIALS ==================== */}
      <section className="bg-surface py-24">
        <div className="container">
          <Reveal>
            <div className="text-center max-w-3xl mx-auto">
              <div className="text-xs font-bold uppercase tracking-[0.3em] text-matcha-700 mb-3">Stimmen aus der Branche</div>
              <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
                Was Restaurant-Inhaber sagen.
              </h2>
            </div>
          </Reveal>

          <div className="mt-14 grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {[
              { stars: 5, name: 'Lisa K.', role: 'Inhaberin, Brewlab Köln', text: 'Wir haben sofort 4 Tablets zur Seite gelegt. Mein Küchenchef atmet wieder.', avatar: 'LK', bg: 'bg-matcha-700' },
              { stars: 5, name: 'Ahmet Y.', role: 'Besitzer, Pidekönig Berlin', text: 'Die 30% Provision an Lieferando haben uns erdrückt. Eigene Bestellseite → 42% mehr Marge. Ernsthaft.', avatar: 'AY', bg: 'bg-gold' },
              { stars: 5, name: 'Marco D.', role: 'GF, La Piazza München', text: 'Der Dienstplan allein war den Wechsel wert. Die Mitarbeiter lieben den Tauschen-Button.', avatar: 'MD', bg: 'bg-matcha-900' },
            ].map((t, i) => (
              <Reveal key={i} delay={i * 100}>
                <div className="rounded-3xl bg-card border p-6 h-full flex flex-col">
                  <div className="flex gap-0.5 text-gold">
                    {Array.from({ length: t.stars }).map((_, j) => <Star key={j} className="h-4 w-4 fill-current" />)}
                  </div>
                  <p className="mt-3 text-matcha-900 text-base leading-relaxed flex-1">„{t.text}"</p>
                  <div className="mt-4 flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white text-xs font-bold ${t.bg}`}>{t.avatar}</div>
                    <div>
                      <div className="font-semibold text-sm">{t.name}</div>
                      <div className="text-xs text-muted-foreground">{t.role}</div>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== PRICING TEASER ==================== */}
      <section className="bg-white py-24 border-t">
        <div className="container max-w-4xl mx-auto text-center">
          <Reveal>
            <div className="text-xs font-bold uppercase tracking-[0.3em] text-matcha-700 mb-3">Preise</div>
            <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
              Transparent. Fair. Modular.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Nutze nur, was du brauchst. Deaktiviere Module jederzeit. Keine versteckten Kosten.
            </p>
          </Reveal>

          <Reveal delay={120}>
            <div className="mt-12 grid md:grid-cols-3 gap-4">
              <PricingCard
                name="Solo"
                price="59"
                desc="Ein Standort, bis 5 Mitarbeiter"
                features={['Dienstplan', 'Kasse', 'Bestellseite', '14 Tage gratis']}
              />
              <PricingCard
                name="Restaurant"
                price="159"
                desc="Volles Set · alle Module · ein Standort"
                features={['Alle 12 Module', 'Unbegrenzt Mitarbeiter', 'Fahrer-App', 'Lieferando/Uber/Wolt']}
                highlight
              />
              <PricingCard
                name="Chain"
                price="Auf Anfrage"
                desc="Mehrere Filialen · Enterprise"
                features={['Cross-Location-Analytics', 'SSO', 'SLA 24/7', 'Dedicated Success']}
              />
            </div>
          </Reveal>

          <Reveal delay={180}>
            <div className="mt-8 text-sm text-muted-foreground">
              Alle Preise netto · Zahlung monatlich · jederzeit kündbar · keine Einrichtungsgebühr
            </div>
          </Reveal>
        </div>
      </section>

      {/* ==================== FAQ ==================== */}
      <section className="bg-surface py-24">
        <div className="container max-w-3xl mx-auto">
          <Reveal>
            <div className="text-center mb-10">
              <div className="text-xs font-bold uppercase tracking-[0.3em] text-matcha-700 mb-3">FAQ</div>
              <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight">Häufig gefragt.</h2>
            </div>
          </Reveal>
          <div className="space-y-3">
            {[
              { q: 'Was kostet Mise in den ersten 14 Tagen?', a: 'Nichts. Keine Kreditkarte erforderlich. Du probierst alle 12 Module frei aus.' },
              { q: 'Kann ich Lieferando/Wolt/Uber anschließen?', a: 'Ja, über Webhook-URLs pro Plattform. Alternativ über Deliverect/Otter als Middleware.' },
              { q: 'Wie ist das mit der Kassenpflicht (TSE/KassSichV)?', a: 'Unsere Kasse ist TSE-ready — du verbindest deine Fiskaly/Swissbit-Box per API. Z-Berichte werden GoBD-konform erstellt.' },
              { q: 'Was passiert nach den 14 Tagen Trial?', a: 'Du kannst einzelne Module deaktivieren oder kostenpflichtig weiter nutzen. Kein automatischer Lock-in — du entscheidest.' },
              { q: 'Was ist mit meinen Daten?', a: 'Gehört dir. Exportierst du jederzeit als CSV/PDF. Server in Deutschland (Hetzner Frankfurt), DSGVO-konform.' },
              { q: 'Brauche ich spezielle Hardware?', a: 'Nein. Läuft im Browser + auf iPhone/Android-Apps für Fahrer und Mitarbeiter. Für die Kasse reicht ein iPad + Bon-Drucker (Epson TM-m30 empfohlen).' },
            ].map((f, i) => (
              <Reveal key={i} delay={i * 50}>
                <details className="group rounded-xl border bg-card px-5 py-3 hover:shadow-subtle transition">
                  <summary className="cursor-pointer list-none font-display font-bold flex items-center justify-between">
                    {f.q}
                    <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
                  </summary>
                  <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== FINAL CTA ==================== */}
      <section className="relative bg-gradient-to-br from-matcha-900 via-matcha-800 to-matcha-700 text-white py-24 overflow-hidden">
        <div className="pointer-events-none absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-accent opacity-15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-40 h-[400px] w-[400px] rounded-full bg-gold opacity-10 blur-3xl" />

        <div className="container relative z-10 text-center max-w-3xl mx-auto">
          <Reveal>
            <h2 className="font-display text-5xl md:text-6xl font-bold tracking-[-0.02em] leading-[0.95]">
              14 Tage testen.<br />
              <span className="text-accent">Null Risiko.</span>
            </h2>
            <p className="mt-6 text-lg text-matcha-100">
              Account in 3 Minuten. Alle 12 Module gratis. Keine Kreditkarte. Keine Bindung. Du raus jederzeit per Klick.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/signup"
                className="group inline-flex h-14 items-center gap-3 rounded-full bg-accent px-8 font-display text-lg font-bold text-matcha-900 hover:bg-accent/90 transition-all"
              >
                Jetzt kostenlos starten
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link href="/login" className="inline-flex h-14 items-center gap-2 text-matcha-100 hover:text-white font-semibold">
                Schon Kunde? Anmelden <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-xs text-matcha-200">
              <span className="inline-flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" /> DSGVO · Server in DE</span>
              <span className="inline-flex items-center gap-1.5"><Zap className="h-3.5 w-3.5" /> Setup in 3 Minuten</span>
              <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5" /> Keine Bindung</span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ==================== FOOTER ==================== */}
      <footer className="bg-matcha-950 text-matcha-300 py-10 text-sm border-t border-matcha-800">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="text-matcha-500">·</span>
            <span className="text-xs">Das Betriebssystem für dein Restaurant</span>
          </div>
          <div className="flex items-center gap-5 text-xs">
            <Link href="/welcome#module" className="hover:text-white">Module</Link>
            <Link href="/signup" className="hover:text-white">Registrieren</Link>
            <Link href="/login" className="hover:text-white">Anmelden</Link>
            <span className="text-matcha-500">© 2026</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* =============================================================
   Subcomponents
============================================================= */

function Nav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-matcha-900/80 backdrop-blur border-b border-white/10">
      <div className="container flex items-center justify-between h-16">
        <Link href="/welcome" className="flex items-center gap-3 text-white group">
          <Logo />
          <div className="hidden sm:flex flex-col leading-none">
            <span className="font-display text-[11px] font-normal text-matcha-300 uppercase tracking-[0.3em]">
              Das Betriebssystem für dein Restaurant
            </span>
          </div>
        </Link>
        <div className="hidden md:flex items-center gap-4 text-sm text-matcha-100">
          <ModulesMenu />
          <Link href="#pricing" className="hover:text-white">Preise</Link>
          <Link href="/login" className="hover:text-white">Anmelden</Link>
        </div>
        <div className="flex items-center gap-2">
          <LangSwitcher variant="dark" />
          <Link
            href="/signup"
            className="hidden sm:inline-flex h-9 items-center gap-2 rounded-full bg-accent px-4 text-sm font-bold text-matcha-900 hover:bg-accent/90"
          >
            Kostenlos starten
          </Link>
          <MobileNav />
        </div>
      </div>
    </nav>
  );
}

function Logo({ dark = false }: { dark?: boolean }) {
  const color = dark ? '#0d1f16' : '#ffffff';
  return (
    <div className="flex items-center gap-2">
      {/* Wordmark: stilisiertes Mise-Monogramm */}
      <svg viewBox="0 0 40 40" className="h-8 w-8" aria-hidden>
        <circle cx="20" cy="20" r="19" fill="none" stroke={color} strokeWidth="2" />
        <path d="M 11 26 L 11 14 L 16 22 L 20 16 L 24 22 L 29 14 L 29 26" stroke={color} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="font-display text-xl font-bold tracking-tight" style={{ color }}>mise</span>
    </div>
  );
}

function Stat({ value, suffix, label, prefix }: { value: string | number; suffix?: string; label: string; prefix?: string }) {
  return (
    <div>
      <div className="font-display text-4xl md:text-5xl font-bold text-white tracking-[-0.02em]">
        {prefix}{value}{suffix}
      </div>
      <div className="mt-1 text-xs text-matcha-300 leading-snug">{label}</div>
    </div>
  );
}

function ModuleSection({
  slug, badge, icon, title, subtitle, benefits, demo, reverse, tint, stat,
}: {
  slug?: string;
  badge: string; icon: string; title: string; subtitle: string; benefits: string[];
  demo: React.ReactNode; reverse?: boolean; tint?: 'beige';
  stat: { value: number; prefix?: string; suffix?: string; label: string };
}) {
  const bg = tint === 'beige' ? 'bg-surface' : 'bg-white';
  return (
    <section className={`${bg} py-20 border-t`}>
      <div className="container">
        <div className={`grid lg:grid-cols-2 gap-12 items-center ${reverse ? 'lg:[&>*:first-child]:order-last' : ''}`}>
          <Reveal>
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.3em] text-matcha-700 mb-4">
                <span className="text-lg">{icon}</span> {badge}
              </div>
              <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight leading-tight">
                {title}
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">{subtitle}</p>

              <ul className="mt-6 space-y-3">
                {benefits.map((b, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <span className="mt-0.5 h-5 w-5 rounded-full bg-matcha-100 text-matcha-700 flex items-center justify-center shrink-0">
                      <Check className="h-3 w-3" />
                    </span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <div className="inline-flex items-baseline gap-2 rounded-2xl bg-matcha-900 text-matcha-50 px-5 py-3">
                  <div className="font-display text-3xl font-bold text-accent">
                    <CountUp end={stat.value} prefix={stat.prefix} suffix={stat.suffix} />
                  </div>
                  <div className="text-sm text-matcha-200">{stat.label}</div>
                </div>
                {slug && (
                  <Link
                    href={`/welcome/${slug}`}
                    className="group inline-flex items-center gap-1 text-matcha-700 font-bold hover:gap-2 transition-all text-sm"
                  >
                    Mehr über {badge}
                    <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                )}
              </div>
            </div>
          </Reveal>

          <Reveal delay={120}>
            {slug ? (
              <Link href={`/welcome/${slug}`} className="block group">
                <div className="transition-transform group-hover:-translate-y-1">
                  {demo}
                </div>
              </Link>
            ) : demo}
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function ComparisonRow({ label, price, good, bad }: { label: string; price?: string; good?: boolean; bad?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        {bad ? <X className="h-4 w-4 text-red-400 shrink-0" /> : <Check className="h-4 w-4 text-accent shrink-0" />}
        <span className={bad ? 'text-red-200' : 'text-matcha-100'}>{label}</span>
      </div>
      {price && <span className={bad ? 'text-red-300 font-mono text-sm' : 'text-accent font-mono text-sm'}>{price}</span>}
    </div>
  );
}

function PricingCard({ name, price, desc, features, highlight }: {
  name: string; price: string; desc: string; features: string[]; highlight?: boolean;
}) {
  return (
    <div className={`rounded-3xl border p-6 text-left relative transition hover:shadow-soft ${highlight ? 'border-matcha-700 border-2 bg-matcha-50 scale-105' : 'border-border bg-card'}`}>
      {highlight && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-matcha-900 text-matcha-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider">
          Meistgewählt
        </div>
      )}
      <div className="font-display text-lg font-bold">{name}</div>
      <div className="mt-2 font-display text-4xl font-bold tracking-tight">
        {price.match(/^\d+$/) ? <><span>{price}</span><span className="text-base font-medium text-muted-foreground"> €</span></> : price}
      </div>
      <div className="text-xs text-muted-foreground">{price.match(/^\d+$/) ? '/Monat' : 'Individuelles Angebot'}</div>
      <p className="mt-3 text-sm text-muted-foreground">{desc}</p>
      <ul className="mt-5 space-y-2 text-sm">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2">
            <Check className="h-4 w-4 text-matcha-700 shrink-0 mt-0.5" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <Link
        href="/signup"
        className={`mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl font-bold transition ${highlight ? 'bg-matcha-900 text-matcha-50 hover:bg-matcha-800' : 'bg-muted hover:bg-matcha-100'}`}
      >
        Starten <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
