'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Check, ChefHat, Clock, MapPin, Package, ShoppingBag, Truck,
  ArrowRight, Share2, Phone,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { StorefrontPhase876DynamischeEtaLiveTracking } from '../[locationSlug]/phase876-dynamische-eta-live-tracking';
import { LiveEtaCountdownBanner } from '../[locationSlug]/live-eta-countdown-banner';

type OrderStatus =
  | 'neu' | 'bestätigt' | 'in_zubereitung' | 'fertig'
  | 'unterwegs' | 'geliefert' | 'abgeholt' | 'storniert';

type TrackData = {
  status: OrderStatus;
  bestellnummer: string;
  kunde_name: string | null;
  eta_earliest: string | null;
  eta_latest: string | null;
  fahrer_vorname: string | null;
  fahrer_fahrzeug: string | null;
  gesamtbetrag?: number | null;
};

const STEPS: { status: OrderStatus[]; label: string; icon: React.ElementType }[] = [
  { status: ['neu', 'bestätigt'],        label: 'Bestätigt',   icon: Check    },
  { status: ['in_zubereitung'],          label: 'Zubereitung', icon: ChefHat  },
  { status: ['fertig'],                  label: 'Bereit',      icon: Package  },
  { status: ['unterwegs'],              label: 'Unterwegs',   icon: Truck    },
  { status: ['geliefert', 'abgeholt'],  label: 'Geliefert',   icon: ShoppingBag },
];

function stepIndex(status: OrderStatus): number {
  return STEPS.findIndex((s) => s.status.includes(status));
}

function EtaCountdown({ iso }: { iso: string }) {
  const [secs, setSecs] = useState(() =>
    Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 1000)),
  );
  useEffect(() => {
    const iv = setInterval(() => {
      setSecs(Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(iv);
  }, [iso]);

  const mm = Math.floor(secs / 60);
  const ss = secs % 60;
  if (secs === 0) return <span className="text-accent font-black">Jeden Moment!</span>;
  return (
    <span className="font-mono font-black tabular-nums text-accent">
      {mm}:{String(ss).padStart(2, '0')}
    </span>
  );
}

export function PaidOrderClient({
  bon,
  amountTotal,
  paid,
}: {
  bon: string | null;
  amountTotal: number | null;
  paid: boolean;
}) {
  const [order, setOrder] = useState<TrackData | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [sharedToast, setSharedToast] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const trackUrl = bon ? `/track/${bon}` : '/';

  useEffect(() => {
    if (!bon) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/delivery/tracking/${bon}`);
        if (!res.ok || cancelled) return;
        const d = await res.json();
        if (cancelled) return;
        setOrder({
          status: d.status as OrderStatus,
          bestellnummer: d.bestellnummer ?? bon,
          kunde_name: d.kunde_name ?? null,
          eta_earliest: d.eta_earliest ?? null,
          eta_latest: d.eta_latest ?? null,
          fahrer_vorname: d.driver_name ?? null,
          fahrer_fahrzeug: d.fahrer_fahrzeug ?? null,
          gesamtbetrag: d.gesamtbetrag ?? null,
        });
      } catch { /* ignore */ }
    };

    poll();
    pollingRef.current = setInterval(poll, 20_000);
    const tickIv = setInterval(() => setNowMs(Date.now()), 1000);

    return () => {
      cancelled = true;
      if (pollingRef.current) clearInterval(pollingRef.current);
      clearInterval(tickIv);
    };
  }, [bon]);

  const status = order?.status ?? 'neu';
  const currentStep = stepIndex(status as OrderStatus);
  const isTerminal = ['geliefert', 'abgeholt', 'storniert'].includes(status);
  const isDelivery = !['abgeholt'].includes(status);

  const etaEarliest = order?.eta_earliest;
  const etaMins = etaEarliest
    ? Math.max(0, Math.floor((new Date(etaEarliest).getTime() - nowMs) / 60_000))
    : null;

  function handleShare() {
    const url = window.location.origin + trackUrl;
    if (navigator.share) {
      navigator.share({ url, title: 'Bestellung verfolgen' }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(url).then(() => {
        setSharedToast(true);
        setTimeout(() => setSharedToast(false), 2500);
      });
    }
  }

  return (
    <div className="min-h-screen bg-matcha-900 text-white flex flex-col items-center justify-start pt-12 px-4 pb-16">
      <div className="w-full max-w-sm">
        {/* Icon */}
        <div className={cn(
          'h-20 w-20 mx-auto rounded-full flex items-center justify-center mb-6 shadow-strong transition-all',
          isTerminal && status !== 'storniert'
            ? 'bg-accent text-matcha-900'
            : status === 'storniert'
            ? 'bg-red-500 text-white'
            : 'bg-accent/20 border-2 border-accent/60 text-accent',
        )}>
          {status === 'geliefert' || status === 'abgeholt'
            ? <ShoppingBag size={36} strokeWidth={2.5} />
            : status === 'unterwegs'
            ? <Truck size={36} strokeWidth={2.5} />
            : <Check size={36} strokeWidth={3} />}
        </div>

        {/* Title */}
        <h1 className="font-display text-4xl font-bold tracking-tight text-center leading-tight">
          {paid ? 'Bezahlt!' : 'Bestellt!'}
        </h1>

        {/* Subtitle */}
        <p className="mt-3 text-matcha-200 text-base text-center">
          {paid && amountTotal != null
            ? `${amountTotal.toFixed(2).replace('.', ',')} € wurden verbucht.`
            : 'Deine Bestellung ist eingegangen.'}
        </p>

        {/* Order number */}
        {bon && (
          <div className="mt-3 text-center font-mono text-xs text-matcha-400 tracking-widest">
            #{bon.replace(/^FF-/, '')}
          </div>
        )}

        {/* Phase 904: Live-ETA-Countdown-Banner — Animierter Schritt-Progress + Sekundengenauer Countdown */}
        {order && !isTerminal && (
          <div className="mt-5">
            <LiveEtaCountdownBanner
              status={status as any}
              etaEarliest={order.eta_earliest}
              etaLatest={order.eta_latest}
              geschaetzteZubereitungMin={null}
              geschaetztelieferungMin={null}
              fahrerVorname={order.fahrer_vorname}
              fahrerFahrzeug={order.fahrer_fahrzeug}
              typ="lieferung"
            />
          </div>
        )}
        {/* Phase 876: Dynamische ETA Live-Tracking — Phasen-Kompass + Fahrer-Proximity + Countdown */}
        {bon && !isTerminal && (
          <div className="mt-5">
            <StorefrontPhase876DynamischeEtaLiveTracking orderId={bon} initialEtaMin={etaMins} />
          </div>
        )}

        {/* Live ETA chip */}
        {etaEarliest && !isTerminal && etaMins !== null && (
          <div className="mt-5 flex items-center justify-center gap-2 rounded-2xl bg-white/5 border border-white/10 px-5 py-3">
            <Clock size={15} className="text-accent shrink-0" />
            <span className="text-sm text-matcha-200">Ankunft in ca.</span>
            {etaMins > 0 ? (
              <span className="font-display font-black text-2xl text-accent tabular-nums">
                {etaMins} Min
              </span>
            ) : (
              <span className="font-display font-black text-xl text-accent">Jeden Moment!</span>
            )}
          </div>
        )}

        {/* Step progress — only if we have order data */}
        {order && (
          <div className="mt-6 rounded-2xl bg-white/5 border border-white/10 p-4">
            <div className="relative flex justify-between">
              {/* connecting line */}
              <div className="absolute top-4 left-4 right-4 h-0.5 bg-white/10">
                <div
                  className="h-full bg-accent transition-all duration-700"
                  style={{ width: `${currentStep >= 0 ? (currentStep / (STEPS.length - 1)) * 100 : 0}%` }}
                />
              </div>

              {STEPS.map((step, i) => {
                const done = currentStep > i;
                const active = currentStep === i;
                const Icon = step.icon;
                return (
                  <div key={step.label} className="flex flex-col items-center gap-1.5 z-10" style={{ width: '20%' }}>
                    <div className={cn(
                      'h-8 w-8 rounded-full border-2 flex items-center justify-center transition-all',
                      done
                        ? 'bg-accent border-accent text-matcha-900'
                        : active
                        ? 'bg-accent/20 border-accent text-accent ring-4 ring-accent/20'
                        : 'bg-matcha-800 border-white/10 text-matcha-500',
                    )}>
                      <Icon size={14} strokeWidth={2.5} />
                    </div>
                    <span className={cn(
                      'text-[9px] font-bold text-center leading-tight',
                      active ? 'text-accent' : done ? 'text-matcha-300' : 'text-matcha-600',
                    )}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Driver info if on route */}
            {status === 'unterwegs' && order.fahrer_vorname && (
              <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-white/5 px-3 py-2.5">
                <Truck size={14} className="text-accent shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-matcha-400 font-bold uppercase tracking-wider">Fahrer</div>
                  <div className="text-sm font-bold text-matcha-100">
                    {order.fahrer_vorname}
                    {order.fahrer_fahrzeug && (
                      <span className="text-matcha-400 font-normal"> · {order.fahrer_fahrzeug}</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-6 space-y-3">
          <Link
            href={trackUrl}
            className="flex items-center justify-center gap-2 rounded-xl bg-accent text-matcha-900 py-4 font-display font-bold text-lg hover:bg-accent/90 active:scale-[0.98] transition w-full"
          >
            <MapPin size={18} />
            Live verfolgen
            <ArrowRight size={18} />
          </Link>

          <button
            onClick={handleShare}
            className="flex items-center justify-center gap-2 rounded-xl bg-white/8 border border-white/10 py-3.5 font-bold text-sm text-matcha-200 hover:bg-white/12 active:scale-[0.98] transition w-full"
          >
            <Share2 size={15} />
            {sharedToast ? 'Link kopiert!' : 'Tracking-Link teilen'}
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-matcha-500">
          Wir schicken dir eine Bestätigung per E-Mail, falls du eine hinterlegt hast.
        </p>
      </div>
    </div>
  );
}
