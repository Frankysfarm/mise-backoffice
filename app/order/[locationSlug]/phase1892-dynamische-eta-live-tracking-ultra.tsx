'use client';

/**
 * Phase 1892 — Dynamische ETA · Live-Tracking-Ultra (Storefront)
 *
 * Kunden-seitiges Live-Tracking mit:
 * - Dynamischer ETA-Countdown (MM:SS)
 * - Phasen-Zeitleiste (bestätigt → Küche → bereit → unterwegs → geliefert)
 * - Farbkodierter Statusanzeige
 * - Fahrernamen + Annäherungshinweis
 * - 15-Sek-Polling. SSR-safe.
 */

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bike, Check, ChefHat, Clock, MapPin, Package } from 'lucide-react';

interface Props {
  orderId: string;
  locationSlug: string;
  className?: string;
}

type Phase = 'confirmed' | 'preparing' | 'ready' | 'on_route' | 'delivered' | 'unknown';

interface TrackingData {
  phase: Phase;
  eta_min: number | null;
  driver_name: string | null;
  driver_near: boolean;
  bestellnummer: string | null;
}

const MOCK: TrackingData = {
  phase: 'preparing',
  eta_min: 22,
  driver_name: null,
  driver_near: false,
  bestellnummer: null,
};

const PHASES: { id: Phase; label: string; icon: React.ReactNode }[] = [
  { id: 'confirmed',  label: 'Bestätigt',     icon: <Package className="h-4 w-4" /> },
  { id: 'preparing',  label: 'Küche',          icon: <ChefHat className="h-4 w-4" /> },
  { id: 'ready',      label: 'Bereit',         icon: <Check className="h-4 w-4" /> },
  { id: 'on_route',   label: 'Unterwegs',      icon: <Bike className="h-4 w-4" /> },
  { id: 'delivered',  label: 'Geliefert',      icon: <MapPin className="h-4 w-4" /> },
];

const PHASE_ORDER: Record<Phase, number> = {
  confirmed: 0, preparing: 1, ready: 2, on_route: 3, delivered: 4, unknown: -1,
};

export function StorefrontPhase1892DynamischeEtaLiveTrackingUltra({ orderId, locationSlug, className }: Props) {
  const [data, setData] = useState<TrackingData>(MOCK);
  const [countdownMin, setCountdownMin] = useState<number | null>(MOCK.eta_min);
  const [mounted, setMounted] = useState(false);
  const etaRef = useRef<number | null>(MOCK.eta_min);
  const fetchedAt = useRef<number>(Date.now());

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch tracking data
  useEffect(() => {
    if (!orderId || !mounted) return;
    const fetchData = async () => {
      try {
        const res = await fetch(
          `/api/delivery/customer/tracking?order_id=${encodeURIComponent(orderId)}&location_slug=${encodeURIComponent(locationSlug)}`,
          { cache: 'no-store' },
        );
        if (res.ok) {
          const json = await res.json();
          setData({
            phase: json.phase ?? 'unknown',
            eta_min: json.eta_min ?? null,
            driver_name: json.driver_name ?? null,
            driver_near: json.driver_near ?? false,
            bestellnummer: json.bestellnummer ?? null,
          });
          etaRef.current = json.eta_min ?? null;
          fetchedAt.current = Date.now();
        }
      } catch {
        // Silently keep last known state
      }
    };
    fetchData();
    const id = setInterval(fetchData, 15_000);
    return () => clearInterval(id);
  }, [orderId, locationSlug, mounted]);

  // Smooth countdown ticker
  useEffect(() => {
    const id = setInterval(() => {
      if (etaRef.current === null) return;
      const elapsedMin = (Date.now() - fetchedAt.current) / 60_000;
      const remaining = Math.max(0, etaRef.current - elapsedMin);
      setCountdownMin(remaining);
    }, 5_000);
    return () => clearInterval(id);
  }, []);

  if (!mounted) return null;
  if (data.phase === 'delivered') return null; // Hide after delivery

  const currentStep = PHASE_ORDER[data.phase] ?? -1;

  function fmtEta(min: number | null): string {
    if (min === null) return '—';
    const m = Math.floor(min);
    const s = Math.floor((min - m) * 60);
    if (min >= 60) return `${Math.floor(min / 60)}h ${min % 60}m`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  const isNearby = data.phase === 'on_route' && data.driver_near;

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      {/* Header */}
      <div className={cn(
        'flex items-center gap-3 px-4 py-3',
        isNearby ? 'bg-matcha-50 dark:bg-matcha-950/30' : 'bg-muted/20',
      )}>
        <div className={cn(
          'flex h-9 w-9 items-center justify-center rounded-full shrink-0',
          isNearby ? 'bg-matcha-500 text-white animate-pulse' : 'bg-muted text-muted-foreground',
        )}>
          {PHASES.find((p) => p.id === data.phase)?.icon ?? <Clock className="h-4 w-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold">
            {isNearby ? 'Fahrer ist fast da!' : (PHASES.find((p) => p.id === data.phase)?.label ?? 'Status unbekannt')}
          </div>
          {data.bestellnummer && (
            <div className="text-[10px] text-muted-foreground">Bestellung #{data.bestellnummer}</div>
          )}
        </div>
        {countdownMin !== null && countdownMin > 0 && (
          <div className="shrink-0 text-right">
            <div className="font-mono text-lg font-black tabular-nums text-foreground">{fmtEta(countdownMin)}</div>
            <div className="text-[9px] text-muted-foreground">ETA</div>
          </div>
        )}
      </div>

      {/* Phasen-Zeitleiste */}
      <div className="px-4 py-3 flex items-center gap-0">
        {PHASES.map((p, i) => {
          const done   = currentStep > i;
          const active = currentStep === i;
          return (
            <div key={p.id} className="flex-1 flex flex-col items-center gap-1">
              {/* Connector line (left side, except for first) */}
              <div className="relative flex items-center w-full justify-center">
                {i > 0 && (
                  <div className={cn(
                    'absolute right-1/2 top-1/2 -translate-y-1/2 h-0.5 w-full',
                    done || active ? 'bg-matcha-400' : 'bg-muted',
                  )} />
                )}
                <div className={cn(
                  'relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 text-[10px] transition-all',
                  done   ? 'bg-matcha-500 border-matcha-500 text-white' :
                  active ? 'bg-white dark:bg-card border-matcha-500 text-matcha-600 ring-2 ring-matcha-200' :
                           'bg-muted/50 border-muted text-muted-foreground',
                )}>
                  {done ? <Check className="h-3 w-3" /> : p.icon}
                </div>
              </div>
              <span className={cn(
                'text-[9px] font-semibold text-center leading-tight',
                active ? 'text-matcha-600 dark:text-matcha-400' :
                done   ? 'text-muted-foreground' : 'text-muted-foreground/50',
              )}>
                {p.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Fahrer-Info */}
      {data.phase === 'on_route' && data.driver_name && (
        <div className="flex items-center gap-2 border-t px-4 py-2.5 text-xs text-muted-foreground">
          <Bike className="h-3.5 w-3.5 text-matcha-500 shrink-0" />
          <span>Fahrer: <span className="font-semibold text-foreground">{data.driver_name}</span></span>
        </div>
      )}
    </div>
  );
}
