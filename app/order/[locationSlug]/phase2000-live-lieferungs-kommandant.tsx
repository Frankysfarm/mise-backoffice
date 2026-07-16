'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Clock, CheckCircle2, Package, Truck, ChefHat, MapPin,
  Navigation2, Star, ChevronDown, ChevronUp,
} from 'lucide-react';

/**
 * Phase 2000 — Live Liefer-Kommandant (Storefront Kunden-View)
 *
 * Umfassendes Live-Tracking-Dashboard für den Kunden:
 * - 4-Phasen-Timeline mit animiertem Aktivschritt
 * - ETA-Countdown in MM:SS mit Konfidenz-Label
 * - Fahrer-Info: Name + Fahrzeug + Annäherungs-Puls wenn auf Route
 * - Bestell-Zusammenfassung: Betrag, Bestellnummer
 * - 15-Sekunden-Polling; zusammenklappbar
 */

type OrderPhase = 'waiting' | 'preparing' | 'ready' | 'on_route' | 'delivered' | 'unknown';

interface LiveData {
  phase: OrderPhase;
  eta_min: number | null;
  elapsed_min: number | null;
  driver_name: string | null;
  driver_vehicle: string | null;
  bestellnummer: string | null;
  gesamtbetrag: number | null;
  prep_min: number | null;
}

const MOCK: LiveData = {
  phase: 'preparing',
  eta_min: 25,
  elapsed_min: 3,
  driver_name: null,
  driver_vehicle: null,
  bestellnummer: 'M-2400',
  gesamtbetrag: 18.9,
  prep_min: 15,
};

const PHASE_STEPS: { key: OrderPhase; label: string; icon: React.ReactNode }[] = [
  { key: 'waiting',   label: 'Eingegangen', icon: <Package className="h-3.5 w-3.5" />  },
  { key: 'preparing', label: 'Zubereitung', icon: <ChefHat className="h-3.5 w-3.5" />  },
  { key: 'on_route',  label: 'Unterwegs',   icon: <Truck className="h-3.5 w-3.5" />    },
  { key: 'delivered', label: 'Geliefert',   icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
];

const PHASE_ORDER: OrderPhase[] = ['waiting', 'preparing', 'ready', 'on_route', 'delivered'];

function phaseIndex(p: OrderPhase): number {
  const map: Record<OrderPhase, number> = {
    waiting: 0, preparing: 1, ready: 2, on_route: 3, delivered: 4, unknown: -1,
  };
  return map[p] ?? -1;
}

function stepActiveIdx(p: OrderPhase): number {
  if (p === 'waiting')   return 0;
  if (p === 'preparing') return 1;
  if (p === 'ready')     return 2;
  if (p === 'on_route')  return 2;
  if (p === 'delivered') return 3;
  return 0;
}

function fmtCountdown(sec: number): string {
  const abs = Math.abs(Math.round(sec));
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const sign = sec < 0 ? '+' : '';
  return `${sign}${m}:${String(s).padStart(2, '0')}`;
}

function fmtEuro(v: number | null): string {
  if (v === null) return '';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v);
}

function etaLabel(remain: number | null, phase: OrderPhase): string {
  if (phase === 'delivered') return 'Geliefert!';
  if (remain === null) return 'Wird berechnet…';
  if (remain > 0) return 'Noch ca.';
  return 'Jeden Moment';
}

export function StorefrontPhase2000LiveLieferungsKommandant({
  orderId,
  locationSlug,
  className,
}: {
  orderId: string;
  locationSlug: string;
  className?: string;
}) {
  const [data, setData] = useState<LiveData>(MOCK);
  const [remainSec, setRemainSec] = useState<number | null>(null);
  const [offen, setOffen] = useState(true);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (!orderId) return;
    const load = () => {
      fetch(
        `/api/delivery/storefront/order-status?order_id=${encodeURIComponent(orderId)}&location_slug=${encodeURIComponent(locationSlug)}`,
      )
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d) setData(d as LiveData); })
        .catch(() => {});
    };
    load();
    const iv = setInterval(load, 15_000);
    return () => clearInterval(iv);
  }, [orderId, locationSlug]);

  useEffect(() => {
    if (data.eta_min === null) { setRemainSec(null); return; }
    const target = data.eta_min * 60;
    const elapsed = (data.elapsed_min ?? 0) * 60;
    let r = target - elapsed;
    setRemainSec(r);
    const tick = setInterval(() => {
      r -= 1;
      setRemainSec(r);
    }, 1_000);
    return () => clearInterval(tick);
  }, [data.eta_min, data.elapsed_min]);

  useEffect(() => {
    if (data.phase !== 'on_route') return;
    const piv = setInterval(() => setPulse((v) => !v), 1_200);
    return () => clearInterval(piv);
  }, [data.phase]);

  if (data.phase === 'unknown') return null;

  const activeStep = stepActiveIdx(data.phase);
  const isDelivered = data.phase === 'delivered';
  const isOnRoute = data.phase === 'on_route';

  const headerBg = isDelivered
    ? 'bg-matcha-600'
    : isOnRoute
    ? 'bg-blue-600'
    : 'bg-matcha-500';

  return (
    <div className={cn('rounded-2xl border bg-card shadow-md overflow-hidden', className)}>
      {/* Header */}
      <button
        onClick={() => setOffen((v) => !v)}
        className={cn(
          'flex w-full items-center gap-2 px-4 py-3 border-b text-white transition-colors',
          headerBg,
        )}
      >
        <Navigation2 className={cn('h-4 w-4 shrink-0', isOnRoute && pulse ? 'opacity-60' : 'opacity-100')} />
        <span className="text-xs font-bold uppercase tracking-wider">Live-Tracking</span>
        {data.bestellnummer && (
          <span className="ml-2 text-[10px] rounded-full bg-white/20 px-2 py-0.5 font-bold">
            #{data.bestellnummer}
          </span>
        )}
        {data.gesamtbetrag && (
          <span className="ml-auto text-[10px] font-bold">{fmtEuro(data.gesamtbetrag)}</span>
        )}
        {offen ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
      </button>

      {offen && (
        <div className="p-4 space-y-4">
          {/* ETA Countdown */}
          {!isDelivered && (
            <div className="flex items-center justify-between rounded-xl border bg-muted/20 px-4 py-3">
              <div>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                  {etaLabel(remainSec, data.phase)}
                </p>
                {remainSec !== null && (
                  <p className={cn(
                    'text-3xl font-black tabular-nums leading-none mt-0.5',
                    remainSec < 0 ? 'text-amber-600' : 'text-foreground',
                  )}>
                    {fmtCountdown(remainSec)}
                  </p>
                )}
              </div>
              <div className={cn(
                'flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all duration-700',
                isOnRoute
                  ? pulse
                    ? 'border-blue-400 bg-blue-100 dark:bg-blue-900/30 scale-110'
                    : 'border-blue-300 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-matcha-300 bg-matcha-50 dark:bg-matcha-900/20',
              )}>
                {isOnRoute ? (
                  <Truck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                ) : (
                  <ChefHat className="h-5 w-5 text-matcha-600 dark:text-matcha-400" />
                )}
              </div>
            </div>
          )}

          {/* Geliefert Banner */}
          {isDelivered && (
            <div className="flex items-center gap-3 rounded-xl border border-matcha-200 bg-matcha-50 dark:bg-matcha-950/20 px-4 py-3">
              <CheckCircle2 className="h-8 w-8 text-matcha-600 shrink-0" />
              <div>
                <p className="text-sm font-black text-matcha-700 dark:text-matcha-300">Guten Appetit! 🎉</p>
                <p className="text-[11px] text-matcha-600/80 dark:text-matcha-400/80">Deine Bestellung wurde geliefert.</p>
              </div>
            </div>
          )}

          {/* 4-Phasen Timeline */}
          <div className="flex items-center gap-0.5">
            {PHASE_STEPS.map((step, idx) => {
              const done = idx <= activeStep || isDelivered;
              const active = idx === activeStep && !isDelivered;
              return (
                <div key={step.key} className="flex flex-1 flex-col items-center gap-1">
                  <div className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full border-2 transition-all duration-300',
                    done && !active
                      ? 'border-matcha-500 bg-matcha-500 text-white'
                      : active
                      ? 'border-matcha-500 bg-white dark:bg-matcha-950 text-matcha-600 dark:text-matcha-400 scale-110 shadow-sm'
                      : 'border-border bg-muted/30 text-muted-foreground',
                  )}>
                    {done && !active ? <CheckCircle2 className="h-3.5 w-3.5" /> : step.icon}
                  </div>
                  <span className={cn(
                    'text-[9px] font-semibold text-center leading-tight',
                    done ? 'text-matcha-600 dark:text-matcha-400' :
                    active ? 'text-foreground font-bold' : 'text-muted-foreground',
                  )}>
                    {step.label}
                  </span>
                  {idx < PHASE_STEPS.length - 1 && (
                    <div className="absolute" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Verbindungslinien */}
          <div className="flex items-center px-3.5 -mt-2">
            {PHASE_STEPS.slice(0, -1).map((_, idx) => (
              <div key={idx} className="flex-1">
                <div className={cn(
                  'h-0.5 w-full transition-all duration-500',
                  idx < activeStep || isDelivered
                    ? 'bg-matcha-500'
                    : 'bg-border',
                )} />
              </div>
            ))}
          </div>

          {/* Fahrer-Info (wenn auf Route) */}
          {isOnRoute && data.driver_name && (
            <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/20 px-3 py-2.5">
              <div className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black text-white transition-all',
                pulse ? 'bg-blue-500 scale-105' : 'bg-blue-600',
              )}>
                {data.driver_name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-blue-800 dark:text-blue-200">{data.driver_name}</p>
                {data.driver_vehicle && (
                  <p className="text-[10px] text-blue-600/80 dark:text-blue-400/80 capitalize">{data.driver_vehicle}</p>
                )}
              </div>
              <div className={cn(
                'flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold transition-all',
                pulse ? 'bg-blue-200 text-blue-800' : 'bg-blue-100 text-blue-700',
              )}>
                <span className={cn('h-1.5 w-1.5 rounded-full', pulse ? 'bg-blue-600' : 'bg-blue-400')} />
                Nähert sich
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
