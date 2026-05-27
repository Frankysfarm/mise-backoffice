import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft, ArrowRight, Check, ChevronRight, Shield, Sparkles, Zap, X,
} from 'lucide-react';
import { findModule, MODULES } from '../modules';
import { Reveal } from '../components/reveal';
import { CountUp } from '../components/count-up';
import { ParallaxBlob, ScrollProgress } from '../components/animations';
import { RoiCalculator } from '../components/roi-calculator';
import { MobileNav } from '../components/mobile-nav';
import { LangSwitcher } from '../components/lang-switcher';
import {
  AnalyticsDemo, CheckupDemo, CleaningDemo, DeliveryDemo, InventoryDemo, KitchenDemo,
  NotificationsDemo, OrderingDemo, PlatformsDemo, PosDemo, ScheduleDemo, TrainingDemo,
} from '../components/module-demos';

export const dynamic = 'force-static';

export function generateStaticParams() {
  return MODULES.map((m) => ({ slug: m.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const m = findModule(slug);
  if (!m) return {};
  return {
    title: `${m.title} · Mise`,
    description: m.tagline,
  };
}

const DEMOS = {
  schedule:      ScheduleDemo,
  inventory:     InventoryDemo,
  ordering:      OrderingDemo,
  kitchen:       KitchenDemo,
  delivery:      DeliveryDemo,
  pos:           PosDemo,
  analytics:     AnalyticsDemo,
  platforms:     PlatformsDemo,
  cleaning:      CleaningDemo,
  checkup:       CheckupDemo,
  training:      TrainingDemo,
  notifications: NotificationsDemo,
};

export default async function ModulePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const m = findModule(slug);
  if (!m) notFound();

  const Demo = DEMOS[m.demo];

  // Nächstes Modul (zur Navigation)
  const idx = MODULES.findIndex((x) => x.slug === slug);
  const next = MODULES[(idx + 1) % MODULES.length];
  const prev = MODULES[(idx - 1 + MODULES.length) % MODULES.length];

  return (
    <div className="bg-surface text-matcha-900 overflow-x-hidden">
      <ScrollProgress />
      <Nav />

      {/* Hero */}
      <section className="relative overflow-hidden bg-matcha-900 text-white pt-24 pb-20">
        <ParallaxBlob className="pointer-events-none absolute -top-20 -right-20 h-96 w-96 rounded-full bg-accent opacity-10 blur-3xl" strength={50} />
        <ParallaxBlob className="pointer-events-none absolute top-40 -left-20 h-80 w-80 rounded-full bg-gold opacity-10 blur-3xl" strength={35} />

        <div className="container relative z-10">
          <Link href="/welcome" className="inline-flex items-center gap-1 text-matcha-300 hover:text-white text-sm mb-6">
            <ArrowLeft size={14} /> Alle Module
          </Link>

          <div className="grid lg:grid-cols-[1.3fr_1fr] gap-10 items-center">
            <Reveal>
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] mb-6">
                  <span className="text-base">{m.icon}</span> {m.badge}
                </div>
                <h1 className="font-display text-4xl md:text-6xl font-bold tracking-[-0.02em] leading-[0.95]">
                  {m.title}
                </h1>
                <p className="mt-6 text-lg md:text-xl text-matcha-100 max-w-xl">
                  {m.subline}
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <Link
                    href="/start"
                    className="group inline-flex h-12 items-center gap-2 rounded-full bg-accent px-6 font-display text-sm font-bold text-matcha-900 hover:bg-accent/90 transition"
                  >
                    14 Tage gratis testen
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                  <Link href="#automations" className="text-sm text-matcha-100 hover:text-white inline-flex items-center gap-1">
                    So funktioniert's <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>

                <div className="mt-10 inline-flex items-baseline gap-2 rounded-2xl bg-white/5 border border-white/10 px-5 py-3 backdrop-blur">
                  <div className="font-display text-3xl font-bold text-accent">
                    <CountUp end={m.stat.value} prefix={m.stat.prefix} suffix={m.stat.suffix} />
                  </div>
                  <div className="text-sm text-matcha-200">{m.stat.label}</div>
                </div>
              </div>
            </Reveal>

            <Reveal delay={120}>
              <Demo />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ROI-Rechner */}
      <RoiCalculator slug={m.slug} />

      {/* Automations — echte Features */}
      <section id="automations" className="bg-white py-20 border-t">
        <div className="container max-w-5xl">
          <Reveal>
            <div className="mb-12 max-w-3xl">
              <div className="text-xs font-bold uppercase tracking-[0.3em] text-matcha-700 mb-3">
                Was das System automatisch macht
              </div>
              <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight">
                Nicht nur ein Tool — es denkt mit.
              </h2>
            </div>
          </Reveal>

          <div className="space-y-10">
            {m.automations.map((a, i) => (
              <Reveal key={i} delay={i * 80}>
                <div className="grid md:grid-cols-[auto_1fr] gap-5">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-matcha-100 text-matcha-900 flex items-center justify-center font-display font-bold shrink-0">
                      {i + 1}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-display text-xl font-bold text-matcha-900">{a.title}</h3>
                    <p className="mt-2 text-base text-muted-foreground leading-relaxed">{a.body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ROI */}
      <section className="bg-matcha-50 py-20 border-t">
        <div className="container">
          <Reveal>
            <div className="text-center mb-10">
              <div className="text-xs font-bold uppercase tracking-[0.3em] text-matcha-700 mb-3">Was du sparst</div>
              <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight">Konkret in Zahlen.</h2>
            </div>
          </Reveal>
          <div className={`grid gap-4 max-w-4xl mx-auto ${m.roi.length === 4 ? 'grid-cols-2 lg:grid-cols-4' : m.roi.length === 3 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'}`}>
            {m.roi.map((r, i) => (
              <Reveal key={i} delay={i * 80}>
                <div className="rounded-2xl bg-white border p-6 text-center">
                  <div className="font-display text-4xl md:text-5xl font-bold text-matcha-700 tracking-[-0.02em]">
                    {r.metric}
                  </div>
                  {r.value && <div className="mt-1 font-display text-sm font-bold">{r.value}</div>}
                  <div className="mt-2 text-xs text-muted-foreground leading-snug">{r.note}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="bg-white py-20 border-t">
        <div className="container max-w-4xl">
          <Reveal>
            <div className="mb-10 text-center">
              <div className="text-xs font-bold uppercase tracking-[0.3em] text-matcha-700 mb-3">Vorher · Nachher</div>
              <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight">Der Unterschied.</h2>
            </div>
          </Reveal>

          <div className="space-y-3">
            {m.comparison.map((c, i) => (
              <Reveal key={i} delay={i * 60}>
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-red-200 bg-red-50/50 p-4 flex items-start gap-3">
                    <X className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                    <div className="text-sm text-red-900">{c.before}</div>
                  </div>
                  <div className="rounded-xl border-2 border-matcha-500 bg-matcha-50 p-4 flex items-start gap-3">
                    <Check className="h-5 w-5 text-matcha-700 shrink-0 mt-0.5" />
                    <div className="text-sm text-matcha-900 font-medium">{c.after}</div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Features-Liste */}
      <section className="bg-matcha-50 py-20 border-t">
        <div className="container max-w-4xl">
          <Reveal>
            <div className="mb-10">
              <div className="text-xs font-bold uppercase tracking-[0.3em] text-matcha-700 mb-3">Alle Features</div>
              <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight">Was drinsteckt.</h2>
            </div>
          </Reveal>
          <div className="grid sm:grid-cols-2 gap-3">
            {m.features.map((f, i) => (
              <Reveal key={i} delay={i * 30}>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-white border">
                  <Check className="h-4 w-4 text-matcha-700 shrink-0 mt-0.5" />
                  <span className="text-sm">{f}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      {m.faq.length > 0 && (
        <section className="bg-white py-20 border-t">
          <div className="container max-w-3xl">
            <Reveal>
              <div className="mb-10 text-center">
                <div className="text-xs font-bold uppercase tracking-[0.3em] text-matcha-700 mb-3">FAQ</div>
                <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight">Häufig gefragt.</h2>
              </div>
            </Reveal>
            <div className="space-y-3">
              {m.faq.map((f, i) => (
                <Reveal key={i} delay={i * 50}>
                  <details className="group rounded-xl border bg-card px-5 py-4">
                    <summary className="cursor-pointer list-none font-display font-bold flex items-center justify-between">
                      {f.q}
                      <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
                    </summary>
                    <p className="mt-3 text-sm text-muted-foreground">{f.a}</p>
                  </details>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Next module CTA */}
      <section className="bg-matcha-900 text-white py-20 border-t border-matcha-800">
        <div className="container max-w-4xl">
          <Reveal>
            <div className="text-center mb-8">
              <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight">
                Nur ein Modul? Nein. <span className="text-accent">Zwölf.</span>
              </h2>
              <p className="mt-3 text-matcha-100">Alles drin, alles verbunden, 14 Tage gratis.</p>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-4">
            <Reveal delay={50}>
              <Link
                href={`/welcome/${prev.slug}`}
                className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:bg-white/10 transition block"
              >
                <div className="text-xs text-matcha-300 uppercase tracking-wider">← Vorheriges</div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-2xl">{prev.icon}</span>
                  <span className="font-display font-bold">{prev.badge}</span>
                </div>
              </Link>
            </Reveal>
            <Reveal delay={120}>
              <Link
                href="/start"
                className="rounded-2xl bg-accent text-matcha-900 p-5 hover:bg-accent/90 transition block text-center font-display font-bold"
              >
                <Sparkles className="h-5 w-5 mx-auto mb-2" />
                <div className="text-sm uppercase tracking-wider opacity-70">Alle Module testen</div>
                <div className="mt-1 text-lg">14 Tage gratis</div>
              </Link>
            </Reveal>
            <Reveal delay={190}>
              <Link
                href={`/welcome/${next.slug}`}
                className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:bg-white/10 transition block text-right"
              >
                <div className="text-xs text-matcha-300 uppercase tracking-wider">Nächstes →</div>
                <div className="mt-2 flex items-center justify-end gap-2">
                  <span className="font-display font-bold">{next.badge}</span>
                  <span className="text-2xl">{next.icon}</span>
                </div>
              </Link>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Final footer trust-chips */}
      <section className="bg-matcha-950 text-matcha-300 py-10 text-sm border-t border-matcha-800">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
          <Link href="/welcome" className="flex items-center gap-2">
            <svg viewBox="0 0 40 40" className="h-6 w-6">
              <circle cx="20" cy="20" r="19" fill="none" stroke="#fff" strokeWidth="2" />
              <path d="M 11 26 L 11 14 L 16 22 L 20 16 L 24 22 L 29 14 L 29 26" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="font-display font-bold text-white">mise</span>
            <span className="text-matcha-500">·</span>
            <span className="text-xs">Das Betriebssystem für dein Restaurant</span>
          </Link>
          <div className="flex items-center gap-5 text-xs">
            <span className="inline-flex items-center gap-1"><Shield className="h-3 w-3" /> DSGVO</span>
            <span className="inline-flex items-center gap-1"><Zap className="h-3 w-3" /> Setup in 3 Min</span>
            <Link href="/login" className="hover:text-white">Anmelden</Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function Nav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-matcha-900/80 backdrop-blur border-b border-white/10">
      <div className="container flex items-center justify-between h-16">
        <Link href="/welcome" className="flex items-center gap-2 text-white">
          <svg viewBox="0 0 40 40" className="h-8 w-8">
            <circle cx="20" cy="20" r="19" fill="none" stroke="#fff" strokeWidth="2" />
            <path d="M 11 26 L 11 14 L 16 22 L 20 16 L 24 22 L 29 14 L 29 26" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="font-display text-xl font-bold tracking-tight">mise</span>
        </Link>
        <div className="hidden md:flex items-center gap-4 text-sm text-matcha-100">
          <Link href="/welcome#module" className="hover:text-white">Module</Link>
          <Link href="/welcome#pricing" className="hover:text-white">Preise</Link>
          <Link href="/login" className="hover:text-white">Anmelden</Link>
        </div>
        <div className="flex items-center gap-2">
          <LangSwitcher variant="dark" />
          <Link
            href="/start"
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
