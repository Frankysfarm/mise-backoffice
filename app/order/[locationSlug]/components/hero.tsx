'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, Clock, MapPin, Star, Store, Truck } from 'lucide-react';
import type { Location, OrderType } from './types';
import { MIN_ORDER } from './types';

type Props = {
  location: Location;
  orderType: OrderType;
  onOrderType: (t: OrderType) => void;
  popularCount: number;
  itemCount: number;
  themeId?: 'classic' | 'bold' | 'minimal' | 'farmhouse' | 'urban' | 'aurora';
  heroImageUrl?: string | null;
  logoUrl?: string | null;
  deliveryTimeMin?: number;
  minOrder?: number;
  deliveryFee?: number;
};

/**
 * Full-bleed editorial hero with dark matcha gradient, floating blobs,
 * meta pills, and the segmented Abholung/Lieferung control.
 */
export function Hero({ location, orderType, onOrderType, popularCount, itemCount, themeId = 'classic', heroImageUrl, logoUrl, deliveryTimeMin = 35, minOrder = 12, deliveryFee = 0 }: Props) {
  // Dispatch auf Theme-spezifisches Layout
  if (themeId === 'bold') {
    return <HeroBold location={location} orderType={orderType} onOrderType={onOrderType} itemCount={itemCount} popularCount={popularCount} heroImageUrl={heroImageUrl} logoUrl={logoUrl} deliveryTimeMin={deliveryTimeMin} minOrder={minOrder} deliveryFee={deliveryFee} />;
  }
  if (themeId === 'minimal' || themeId === 'urban') {
    return <HeroMinimal location={location} orderType={orderType} onOrderType={onOrderType} itemCount={itemCount} popularCount={popularCount} heroImageUrl={heroImageUrl} logoUrl={logoUrl} themeId={themeId} deliveryTimeMin={deliveryTimeMin} minOrder={minOrder} deliveryFee={deliveryFee} />;
  }
  if (themeId === 'aurora') {
    return <HeroAurora location={location} orderType={orderType} onOrderType={onOrderType} itemCount={itemCount} popularCount={popularCount} heroImageUrl={heroImageUrl} logoUrl={logoUrl} deliveryTimeMin={deliveryTimeMin} minOrder={minOrder} deliveryFee={deliveryFee} />;
  }
  if (themeId === 'farmhouse') {
    return <HeroClassic location={location} orderType={orderType} onOrderType={onOrderType} itemCount={itemCount} popularCount={popularCount} heroImageUrl={heroImageUrl} logoUrl={logoUrl} themeId={themeId} deliveryTimeMin={deliveryTimeMin} minOrder={minOrder} deliveryFee={deliveryFee} />;
  }
  // Classic (Default)
  return <HeroClassic location={location} orderType={orderType} onOrderType={onOrderType} itemCount={itemCount} popularCount={popularCount} heroImageUrl={heroImageUrl} logoUrl={logoUrl} deliveryTimeMin={deliveryTimeMin} minOrder={minOrder} deliveryFee={deliveryFee} />;
}

type VariantProps = Omit<Props, 'themeId'>;

function HeroClassic({ location, orderType, onOrderType, popularCount, itemCount, heroImageUrl, logoUrl, themeId, deliveryTimeMin, minOrder, deliveryFee }: VariantProps & { themeId?: 'classic' | 'farmhouse' | 'aurora' }) {
  const now = new Date();
  const closeHour = 19;
  const isOpen = now.getHours() < closeHour;

  // Live-Küchenlast: pollt /api/delivery/eta/live alle 60s
  const [liveEta, setLiveEta] = React.useState<{ eta_min: number; load: 'low' | 'medium' | 'high' } | null>(null);
  React.useEffect(() => {
    if (!location.id || orderType !== 'lieferung') return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/delivery/eta/live?location_id=${location.id}`);
        if (!res.ok) return;
        const d = await res.json();
        if (d?.eta_min != null) {
          const load: 'low' | 'medium' | 'high' = d.eta_min > 45 ? 'high' : d.eta_min > 30 ? 'medium' : 'low';
          setLiveEta({ eta_min: d.eta_min, load });
        }
      } catch {}
    };
    poll();
    const iv = setInterval(poll, 60_000);
    return () => clearInterval(iv);
  }, [location.id, orderType]);

  // Palette pro Theme — bestimmt Hintergrund, Akzent-Farbe, Text-Farben
  const p = themeId === 'farmhouse'
    ? {
        bg: 'bg-gradient-to-br from-[#F8F1E4] via-[#F4E8D4] to-[#E2D3B7]',
        text: 'text-[#2B1F17]',
        textMuted: 'text-[#7A6A5C]',
        accent: '#D2463A',
        accentBg: 'bg-[#D2463A]',
        accentBgLight: 'bg-[#D2463A]/15',
        accentText: 'text-[#D2463A]',
        accentTextOn: 'text-white',
        ringSoft: 'ring-[#D2463A]/20',
        toggleBg: 'bg-white/80 ring-[#E2D3B7]',
        toggleActive: 'bg-[#D2463A] text-white',
        toggleInactive: 'text-[#4A3A2C] hover:text-[#D2463A]',
        loginBg: 'bg-white/70',
      }
    : themeId === 'aurora'
    ? {
        bg: 'bg-gradient-to-br from-white via-[#FAFAFA] to-[#EEF2FF]',
        text: 'text-[#0A0A0A]',
        textMuted: 'text-[#52525B]',
        accent: '#4F46E5',
        accentBg: 'bg-[#4F46E5]',
        accentBgLight: 'bg-[#4F46E5]/12',
        accentText: 'text-[#4F46E5]',
        accentTextOn: 'text-white',
        ringSoft: 'ring-[#4F46E5]/20',
        toggleBg: 'bg-white/80 ring-[#E4E4E7]',
        toggleActive: 'bg-[#4F46E5] text-white shadow-md shadow-[#4F46E5]/30',
        toggleInactive: 'text-[#52525B] hover:text-[#4F46E5]',
        loginBg: 'bg-white/70',
      }
    : {
        // classic (Matcha-Grün — bestehend)
        bg: 'bg-gradient-to-br from-matcha-900 via-matcha-800 to-matcha-700',
        text: 'text-matcha-50',
        textMuted: 'text-matcha-200',
        accent: '#4ae68a',
        accentBg: 'bg-accent',
        accentBgLight: 'bg-accent/20',
        accentText: 'text-accent',
        accentTextOn: 'text-matcha-900',
        ringSoft: 'ring-white/20',
        toggleBg: 'bg-matcha-900/70 ring-white/10',
        toggleActive: 'bg-accent text-matcha-900',
        toggleInactive: 'text-matcha-100 hover:text-white',
        loginBg: 'bg-white/10',
      };

  return (
    <section className={cn('relative isolate overflow-hidden', p.bg, p.text)}>
      {heroImageUrl && (
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none opacity-25 mix-blend-overlay"
          style={{ backgroundImage: `url(${heroImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
        />
      )}
      {/* Noise dots */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-20 mix-blend-overlay"
        style={{ backgroundImage: 'radial-gradient(rgba(0,0,0,0.18) 1px, transparent 1px)', backgroundSize: '3px 3px' }}
      />
      {/* Theme-Akzent-Blobs */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className={cn('absolute -left-32 top-20 h-80 w-80 rounded-full blur-3xl motion-safe:animate-[pulse_8s_ease-in-out_infinite]', p.accentBgLight)} />
        <div className="absolute -right-40 top-1/3 h-96 w-96 rounded-full bg-white/8 blur-3xl" />
      </div>

      {/* TOP-STRIP: kompakter Status-Streifen ganz oben */}
      <div className={cn('relative border-b', p.text === 'text-matcha-50' ? 'border-white/10' : 'border-black/5')}>
        <div className="relative mx-auto flex max-w-6xl items-center justify-between px-4 py-1.5 md:px-8">
          <div className={cn('flex items-center gap-1.5 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider', p.textMuted)}>
            <span className={cn('inline-block h-1.5 w-1.5 rounded-full', isOpen ? p.accentBg : 'bg-red-400', isOpen && 'motion-safe:animate-pulse')} />
            <span className={p.text}>{isOpen ? `Geöffnet bis ${closeHour} Uhr` : 'Geschlossen'}</span>
            <span className="opacity-40">·</span>
            <span>{location.stadt ?? 'Aachen'}</span>
          </div>
          <a href="/login" className={cn('text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider hover:opacity-70', p.textMuted)}>
            Login
          </a>
        </div>
      </div>

      {/* HERO-BODY: Logo prominent + Order-Toggle. KEIN Name mehr. */}
      <div className="relative mx-auto max-w-6xl px-4 py-3 md:px-8 md:py-4">
        <div className="flex items-center gap-3 sm:gap-4">
          {logoUrl ? (
            <img src={logoUrl} alt={location.name} className={cn('h-14 w-14 sm:h-16 sm:w-16 flex-shrink-0 rounded-2xl object-cover ring-1 shadow-sm', p.ringSoft)} />
          ) : (
            <div className={cn('h-14 w-14 sm:h-16 sm:w-16 flex-shrink-0 rounded-2xl grid place-items-center font-display font-black text-2xl shadow-sm', p.accentBg, p.accentTextOn)}>
              {location.name.charAt(0)}
            </div>
          )}

          <div className="flex-1 flex flex-col gap-1.5">
            <div className={cn('inline-flex w-full items-center gap-1 rounded-full p-1 ring-1 backdrop-blur-md', p.toggleBg)}>
              <button
                type="button"
                onClick={() => onOrderType('abholung')}
                aria-pressed={orderType === 'abholung'}
                className={cn(
                  'flex-1 inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs sm:text-sm font-semibold transition',
                  orderType === 'abholung' ? p.toggleActive : p.toggleInactive,
                )}
              >
                <Store className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Abholung
              </button>
              <button
                type="button"
                onClick={() => onOrderType('lieferung')}
                aria-pressed={orderType === 'lieferung'}
                className={cn(
                  'flex-1 inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs sm:text-sm font-semibold transition',
                  orderType === 'lieferung' ? p.toggleActive : p.toggleInactive,
                )}
              >
                <Truck className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Lieferung
              </button>
            </div>
            {/* Live-ETA chip (nur bei Lieferung) */}
            {orderType === 'lieferung' && liveEta && (
              <div className={cn(
                'self-start inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold',
                liveEta.load === 'high' ? 'bg-red-500/20 text-red-300' :
                liveEta.load === 'medium' ? 'bg-amber-500/20 text-amber-300' :
                'bg-accent/20 text-accent',
              )}>
                <span className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  liveEta.load === 'high' ? 'bg-red-400 animate-pulse' :
                  liveEta.load === 'medium' ? 'bg-amber-400' : 'bg-accent',
                )} />
                {liveEta.load === 'high' ? 'Sehr ausgelastet' : liveEta.load === 'medium' ? 'Etwas ausgelastet' : 'Küche bereit'}
                {' · '}~{liveEta.eta_min} Min
              </div>
            )}
            {orderType === 'lieferung' && !liveEta && deliveryTimeMin && (
              <div className={cn('self-start inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold', p.accentBgLight, p.accentText)}>
                <Clock className="h-3 w-3" /> ~{deliveryTimeMin} Min
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ==================================================================== */
/* BOLD — Vollbild-Foto mit dickem Titel-Overlay (Uber-Eats-Style)      */
/* ==================================================================== */
function HeroBold({ location, orderType, onOrderType, popularCount, itemCount, heroImageUrl, logoUrl, deliveryTimeMin, minOrder, deliveryFee }: VariantProps) {
  const closeHour = 19;
  const isOpen = new Date().getHours() < closeHour;

  const [liveEta, setLiveEta] = React.useState<{ eta_min: number; load: 'low' | 'medium' | 'high' } | null>(null);
  React.useEffect(() => {
    if (!location.id || orderType !== 'lieferung') return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/delivery/eta/live?location_id=${location.id}`);
        if (!res.ok) return;
        const d = await res.json();
        if (d?.eta_min != null) {
          const load: 'low' | 'medium' | 'high' = d.eta_min > 45 ? 'high' : d.eta_min > 30 ? 'medium' : 'low';
          setLiveEta({ eta_min: d.eta_min, load });
        }
      } catch {}
    };
    poll();
    const iv = setInterval(poll, 60_000);
    return () => clearInterval(iv);
  }, [location.id, orderType]);

  return (
    <section className="relative isolate overflow-hidden min-h-[min(820px,92vh)] bg-black text-white">
      {/* Vollbild-Bild */}
      {heroImageUrl ? (
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: `url(${heroImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
        />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-neutral-900 via-black to-neutral-950" />
      )}
      {/* Dunkler Overlay für Lesbarkeit */}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-black/90" />

      <div className="relative mx-auto flex min-h-[inherit] max-w-6xl flex-col justify-end px-5 pb-12 pt-20 md:px-10 md:pb-16">
        {logoUrl && (
          <img src={logoUrl} alt={location.name} className="h-14 w-14 mb-6 object-contain" />
        )}

        <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#ff5a1f] mb-3">
          {isOpen ? '⬤ Jetzt geöffnet' : 'Geschlossen'} · {location.stadt ?? 'Aachen'}
        </div>

        <h1 className="font-display text-6xl md:text-8xl lg:text-9xl font-black tracking-[-0.04em] leading-[0.88] uppercase">
          {location.name}
        </h1>

        <p className="mt-5 text-xl text-white/80 max-w-2xl font-medium">
          {itemCount} Gerichte auf der Karte · Lieferung in ca. 25 Min · {popularCount} Favoriten
        </p>

        {/* Order-Type-Toggle — große eckige Buttons */}
        <div className="mt-8 flex gap-2 flex-wrap">
          <button
            onClick={() => onOrderType('abholung')}
            className={cn(
              'inline-flex items-center gap-2 px-6 py-3 text-sm font-bold uppercase tracking-wider transition',
              orderType === 'abholung' ? 'bg-[#ff5a1f] text-white' : 'bg-white/10 backdrop-blur text-white border border-white/20 hover:bg-white/20',
            )}
          >
            <Store className="h-4 w-4" /> Abholung
          </button>
          <button
            onClick={() => onOrderType('lieferung')}
            className={cn(
              'inline-flex items-center gap-2 px-6 py-3 text-sm font-bold uppercase tracking-wider transition',
              orderType === 'lieferung' ? 'bg-[#ff5a1f] text-white' : 'bg-white/10 backdrop-blur text-white border border-white/20 hover:bg-white/20',
            )}
          >
            <Truck className="h-4 w-4" /> Lieferung · {MIN_ORDER}€ min.
          </button>
        </div>
        {/* Live-ETA chip (nur bei Lieferung) */}
        {orderType === 'lieferung' && liveEta && (
          <div className={cn(
            'mt-3 self-start inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold backdrop-blur',
            liveEta.load === 'high' ? 'bg-red-500/25 text-red-300 border border-red-400/30' :
            liveEta.load === 'medium' ? 'bg-amber-500/25 text-amber-300 border border-amber-400/30' :
            'bg-white/15 text-white border border-white/20',
          )}>
            <span className={cn(
              'h-1.5 w-1.5 rounded-full',
              liveEta.load === 'high' ? 'bg-red-400 animate-pulse' :
              liveEta.load === 'medium' ? 'bg-amber-400' : 'bg-green-400',
            )} />
            {liveEta.load === 'high' ? 'Sehr ausgelastet' : liveEta.load === 'medium' ? 'Etwas ausgelastet' : 'Küche bereit'}
            {' · '}~{liveEta.eta_min} Min
          </div>
        )}
        {orderType === 'lieferung' && !liveEta && deliveryTimeMin && (
          <div className="mt-3 self-start inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/20 px-3 py-1.5 text-[11px] font-semibold text-white/80 backdrop-blur">
            <Clock className="h-3 w-3" /> ~{deliveryTimeMin} Min Lieferzeit
          </div>
        )}
      </div>
    </section>
  );
}

/* ==================================================================== */
/* MINIMAL — Reduziert, Split-Layout: Typo links, kleines Bild rechts   */
/* ==================================================================== */
function HeroMinimal({ location, orderType, onOrderType, popularCount, itemCount, heroImageUrl, logoUrl, themeId, deliveryTimeMin, minOrder, deliveryFee }: VariantProps & { themeId?: 'minimal' | 'urban' }) {
  const closeHour = 19;
  const isOpen = new Date().getHours() < closeHour;

  const [liveEta, setLiveEta] = React.useState<{ eta_min: number; load: 'low' | 'medium' | 'high' } | null>(null);
  React.useEffect(() => {
    if (!location.id || orderType !== 'lieferung') return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/delivery/eta/live?location_id=${location.id}`);
        if (!res.ok) return;
        const d = await res.json();
        if (d?.eta_min != null) {
          const load: 'low' | 'medium' | 'high' = d.eta_min > 45 ? 'high' : d.eta_min > 30 ? 'medium' : 'low';
          setLiveEta({ eta_min: d.eta_min, load });
        }
      } catch {}
    };
    poll();
    const iv = setInterval(poll, 60_000);
    return () => clearInterval(iv);
  }, [location.id, orderType]);

  const p = themeId === 'urban'
    ? {
        section: 'bg-[#0A0A0A] text-[#FAFAFA] border-b border-[#262626]',
        muted: 'text-[#A3A3A3]',
        mutedDot: 'bg-[#262626]',
        statusOk: 'bg-[#00D964]',
        body: 'text-[#A3A3A3]',
        underlineBar: 'border-[#262626]',
        tabActive: 'border-[#00D964] text-[#FAFAFA]',
        tabInactive: 'border-transparent text-[#6B6B6B] hover:text-[#FAFAFA]',
      }
    : {
        section: 'bg-neutral-50 text-neutral-900 border-b border-neutral-200',
        muted: 'text-neutral-500',
        mutedDot: 'bg-neutral-300',
        statusOk: 'bg-emerald-500',
        body: 'text-neutral-600',
        underlineBar: 'border-neutral-200',
        tabActive: 'border-neutral-900 text-neutral-900',
        tabInactive: 'border-transparent text-neutral-500 hover:text-neutral-900',
      };

  return (
    <section className={cn('relative isolate overflow-hidden', p.section)}>
      <div className="mx-auto max-w-6xl px-5 md:px-10 py-16 md:py-24">
        <div className="grid md:grid-cols-[1fr_auto] gap-10 items-center">
          <div>
            {logoUrl && (
              <img src={logoUrl} alt={location.name} className="h-10 w-10 mb-6 object-contain opacity-80" />
            )}

            <div className={cn('flex items-center gap-3 text-[11px] font-medium mb-4', p.muted)}>
              <span className={cn('h-1.5 w-1.5 rounded-full', isOpen ? p.statusOk : 'bg-neutral-400')} />
              <span>{isOpen ? `Geöffnet bis ${closeHour}:00` : 'Geschlossen'}</span>
              <span className={p.mutedDot.replace('bg-', 'text-')}>—</span>
              <span>{location.stadt ?? 'Aachen'}</span>
            </div>

            <h1 className="font-display text-5xl md:text-7xl font-normal tracking-[-0.03em] leading-[0.95]">
              {location.name}
            </h1>

            <div className={cn('mt-5 text-base max-w-md leading-relaxed', p.body)}>
              {itemCount} ausgewählte Gerichte. {popularCount > 0 && `${popularCount} Favoriten der Gäste. `}
              Mindestbestellwert {MIN_ORDER} €.
            </div>

            <div className={cn('mt-8 inline-flex border-b-2', p.underlineBar)}>
              <button
                onClick={() => onOrderType('abholung')}
                className={cn(
                  'px-5 py-3 text-sm font-semibold border-b-2 -mb-[2px] transition',
                  orderType === 'abholung' ? p.tabActive : p.tabInactive,
                )}
              >
                Abholung
              </button>
              <button
                onClick={() => onOrderType('lieferung')}
                className={cn(
                  'px-5 py-3 text-sm font-semibold border-b-2 -mb-[2px] transition',
                  orderType === 'lieferung' ? p.tabActive : p.tabInactive,
                )}
              >
                Lieferung
              </button>
            </div>
            {/* Live-ETA chip (nur bei Lieferung) */}
            {orderType === 'lieferung' && liveEta && (
              <div className={cn(
                'mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold',
                liveEta.load === 'high' ? 'bg-red-50 text-red-600 ring-1 ring-red-200' :
                liveEta.load === 'medium' ? 'bg-amber-50 text-amber-600 ring-1 ring-amber-200' :
                themeId === 'urban' ? 'bg-[#00D964]/15 text-[#00D964] ring-1 ring-[#00D964]/30' :
                'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
              )}>
                <span className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  liveEta.load === 'high' ? 'bg-red-500 animate-pulse' :
                  liveEta.load === 'medium' ? 'bg-amber-500' :
                  themeId === 'urban' ? 'bg-[#00D964]' : 'bg-emerald-500',
                )} />
                {liveEta.load === 'high' ? 'Sehr ausgelastet' : liveEta.load === 'medium' ? 'Etwas ausgelastet' : 'Küche bereit'}
                {' · '}~{liveEta.eta_min} Min
              </div>
            )}
            {orderType === 'lieferung' && !liveEta && deliveryTimeMin && (
              <div className={cn(
                'mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold',
                themeId === 'urban' ? 'bg-white/10 text-[#A3A3A3] ring-1 ring-white/10' : 'bg-neutral-100 text-neutral-600 ring-1 ring-neutral-200',
              )}>
                <Clock className="h-3 w-3" /> ~{deliveryTimeMin} Min
              </div>
            )}
          </div>

          {/* Kleines quadratisches Bild rechts (wenn vorhanden) */}
          {heroImageUrl && (
            <div className="hidden md:block">
              <img src={heroImageUrl} alt="" className="h-56 w-56 object-cover rounded-lg" />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ==================================================================== */
/* AURORA — Premium Apple-Card-Inspired Hero                            */
/* ==================================================================== */
function HeroAurora({ location, orderType, onOrderType, popularCount, itemCount, heroImageUrl, logoUrl, deliveryTimeMin, minOrder, deliveryFee }: VariantProps) {
  const closeHour = 19;
  const isOpen = new Date().getHours() < closeHour;

  return (
    <section className="relative isolate overflow-hidden">
      {/* Aurora-Wave SVG decoration behind headline */}
      <svg
        className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 w-full h-32 opacity-60"
        viewBox="0 0 800 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="auroraWave1" x1="0" y1="0" x2="800" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#22D3EE" stopOpacity="0" />
            <stop offset="50%" stopColor="#6366F1" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#F472B6" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="auroraWave2" x1="0" y1="0" x2="800" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0" />
            <stop offset="50%" stopColor="#22D3EE" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#6366F1" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M0 100 Q 200 40, 400 100 T 800 100" stroke="url(#auroraWave1)" strokeWidth="1.5" fill="none">
          <animate attributeName="d" dur="14s" repeatCount="indefinite"
            values="M0 100 Q 200 40, 400 100 T 800 100;
                    M0 100 Q 200 140, 400 100 T 800 100;
                    M0 100 Q 200 40, 400 100 T 800 100" />
        </path>
        <path d="M0 120 Q 200 60, 400 120 T 800 120" stroke="url(#auroraWave2)" strokeWidth="1" fill="none">
          <animate attributeName="d" dur="18s" repeatCount="indefinite"
            values="M0 120 Q 200 60, 400 120 T 800 120;
                    M0 120 Q 200 180, 400 120 T 800 120;
                    M0 120 Q 200 60, 400 120 T 800 120" />
        </path>
      </svg>

      <div className="relative mx-auto max-w-6xl px-6 pt-16 pb-12 md:px-8 md:pt-24 md:pb-16">
        {/* Top row: Logo + Login */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt={location.name} className="h-11 w-11 rounded-2xl object-cover ring-1 ring-white/15" />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] font-display font-black text-lg text-white shadow-lg shadow-[#6366F1]/30">
                {location.name.charAt(0)}
              </div>
            )}
          </div>
          <a href="/login" className="glass-pill" style={{ height: 36, padding: '0 14px', fontSize: 13 }}>
            Login
          </a>
        </div>

        {/* Eyebrow */}
        <div className="mb-5 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: '#22D3EE', textShadow: '0 0 20px rgba(34, 211, 238, 0.4)' }}>
          <span>Sustainably crafted · Daily delivered</span>
        </div>

        {/* Display headline */}
        <h1 className="font-display max-w-3xl" style={{ fontSize: 'clamp(40px, 8vw, 72px)', fontWeight: 700, lineHeight: 1.05, letterSpacing: '-0.04em' }}>
          {location.name}
        </h1>

        {/* Lede */}
        <p className="mt-5 max-w-xl text-lg leading-relaxed" style={{ color: '#CBD5E1', letterSpacing: '-0.01em' }}>
          {itemCount} kuratierte Gerichte aus {location.stadt ?? 'Aachen'}.
          {popularCount > 0 ? ` ${popularCount} Favoriten der Stammgäste.` : ''}
        </p>

        {/* Glass-Pills row */}
        <div className="mt-8 flex flex-wrap gap-2">
          <div className="glass-pill glass-pill--accent">
            <span className="dot" />
            <span>{isOpen ? 'Geöffnet' : 'Geschlossen'}</span>
          </div>
          {orderType === 'lieferung' && deliveryTimeMin ? (
            <div className="glass-pill">
              <svg className="icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
              </svg>
              <span>{deliveryTimeMin} Min</span>
            </div>
          ) : null}
          {orderType === 'lieferung' && minOrder ? (
            <div className="glass-pill">
              <svg className="icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
              <span>ab {minOrder} €</span>
            </div>
          ) : null}
          {orderType === 'lieferung' && deliveryFee && deliveryFee > 0 ? (
            <div className="glass-pill">
              <svg className="icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
              <span>{deliveryFee.toFixed(2).replace('.', ',')} € Versand</span>
            </div>
          ) : null}
        </div>

        {/* Order-type toggle */}
        <div className="mt-10 inline-flex w-full max-w-md items-center gap-1 rounded-full p-1 sm:w-auto" style={{ background: 'rgba(255, 255, 255, 0.06)', backdropFilter: 'blur(20px) saturate(1.4)', border: '1px solid rgba(255, 255, 255, 0.10)' }}>
          <button
            type="button"
            onClick={() => onOrderType('abholung')}
            aria-pressed={orderType === 'abholung'}
            className={cn(
              'flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition',
            )}
            style={
              orderType === 'abholung'
                ? { background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: 'white', boxShadow: '0 4px 16px rgba(99, 102, 241, 0.4)' }
                : { color: '#CBD5E1' }
            }
          >
            <Store className="h-4 w-4" /> Abholung
          </button>
          <button
            type="button"
            onClick={() => onOrderType('lieferung')}
            aria-pressed={orderType === 'lieferung'}
            className={cn(
              'flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition',
            )}
            style={
              orderType === 'lieferung'
                ? { background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: 'white', boxShadow: '0 4px 16px rgba(99, 102, 241, 0.4)' }
                : { color: '#CBD5E1' }
            }
          >
            <Truck className="h-4 w-4" /> Lieferung
          </button>
        </div>
      </div>
    </section>
  );
}

