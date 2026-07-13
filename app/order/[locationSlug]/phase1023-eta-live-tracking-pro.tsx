'use client';

// Phase 1022 (Storefront) — ETA-Live-Tracking Pro
// Dynamische ETA mit Echtzeit-Countdown + Phasen-Fortschritt + Fahrer-Annäherungsanzeige.
// Polling alle 30s · Mock-Fallback · keine externen Deps außer cn

import { useEffect, useRef, useState, useCallback } from 'react';
import { ChefHat, Bike, CheckCircle2, Package, Clock, MapPin, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivering' | 'delivered' | string;

interface TrackingData {
  status: OrderStatus;
  eta_min: number | null;
  fahrer_name: string | null;
  fahrer_entfernung_km: number | null;
  geschaetzte_lieferzeit_min: number | null;
  kochstart_at: string | null;
  fertig_at: string | null;
  abholung_at: string | null;
}

interface Props {
  orderId: string | null;
  status?: OrderStatus | null;
  etaMinutes?: number | null;
  driverName?: string | null;
  className?: string;
}

const PHASES: { key: OrderStatus; label: string; icon: React.ReactNode; desc: string }[] = [
  { key: 'confirmed', label: 'Bestätigt', icon: <CheckCircle2 className="h-4 w-4" />, desc: 'Bestellung eingegangen' },
  { key: 'preparing', label: 'In Zubereitung', icon: <ChefHat className="h-4 w-4" />, desc: 'Küche arbeitet' },
  { key: 'ready', label: 'Fertig', icon: <Package className="h-4 w-4" />, desc: 'Warte auf Abholung' },
  { key: 'delivering', label: 'Unterwegs', icon: <Bike className="h-4 w-4" />, desc: 'Fahrer kommt' },
  { key: 'delivered', label: 'Geliefert', icon: <CheckCircle2 className="h-4 w-4" />, desc: 'Guten Appetit!' },
];

const STATUS_ORDER: Record<string, number> = {
  pending: 0, confirmed: 1, preparing: 2, ready: 3, delivering: 4, delivered: 5,
};

const POLL_MS = 30_000;

const MOCK: TrackingData = {
  status: 'preparing',
  eta_min: 24,
  fahrer_name: 'Thomas K.',
  fahrer_entfernung_km: null,
  geschaetzte_lieferzeit_min: 12,
  kochstart_at: new Date(Date.now() - 5 * 60_000).toISOString(),
  fertig_at: null,
  abholung_at: null,
};

export function StorefrontPhase1023EtaLiveTrackingPro({ orderId, status, etaMinutes, driverName, className }: Props) {
  const [data, setData] = useState<TrackingData | null>(null);
  const [etaCountdown, setEtaCountdown] = useState<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const etaStartRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    if (!orderId) return;
    try {
      const res = await fetch(`/api/delivery/customer/order-tracking?order_id=${orderId}`);
      if (res.ok) {
        const d: TrackingData = await res.json();
        setData(d);
        if (d.eta_min != null) {
          etaStartRef.current = Date.now();
          setEtaCountdown(d.eta_min * 60);
        }
      } else {
        const fallback: TrackingData = {
          status: (status as OrderStatus) ?? 'preparing',
          eta_min: etaMinutes ?? 25,
          fahrer_name: driverName ?? null,
          fahrer_entfernung_km: null,
          geschaetzte_lieferzeit_min: null,
          kochstart_at: null,
          fertig_at: null,
          abholung_at: null,
        };
        setData(fallback);
        if (fallback.eta_min != null) {
          etaStartRef.current = Date.now();
          setEtaCountdown(fallback.eta_min * 60);
        }
      }
    } catch {
      setData(MOCK);
      etaStartRef.current = Date.now();
      setEtaCountdown((MOCK.eta_min ?? 24) * 60);
    }
  }, [orderId, status, etaMinutes, driverName]);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  // Sekunden-Countdown
  useEffect(() => {
    if (etaCountdown == null) return;
    countdownRef.current = setInterval(() => {
      setEtaCountdown(prev => {
        if (prev == null || prev <= 0) return 0;
        return prev - 1;
      });
    }, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [etaCountdown != null]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return null;

  const currentIdx = STATUS_ORDER[data.status] ?? 1;
  const isDelivered = data.status === 'delivered';
  const isDelivering = data.status === 'delivering';

  const countdownMin = etaCountdown != null ? Math.floor(etaCountdown / 60) : null;
  const countdownSec = etaCountdown != null ? etaCountdown % 60 : null;
  const countdownLate = etaCountdown != null && etaCountdown <= 0;

  return (
    <div className={cn('rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 shadow-sm overflow-hidden', className)}>
      {/* Header */}
      <div className={cn(
        'px-4 py-3 flex items-center justify-between',
        isDelivered ? 'bg-emerald-600' : isDelivering ? 'bg-blue-600' : 'bg-stone-800',
        'text-white',
      )}>
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-yellow-300" />
          <span className="text-sm font-bold">Live-Tracking</span>
        </div>
        {!isDelivered && etaCountdown != null && (
          <div className="text-right">
            <div className={cn('font-mono text-lg font-black', countdownLate && 'animate-pulse text-red-300')}>
              {countdownLate ? 'jeden Moment' : `${countdownMin}:${String(countdownSec).padStart(2, '0')}`}
            </div>
            <div className="text-[9px] text-white/70">verbleibend</div>
          </div>
        )}
        {isDelivered && (
          <span className="text-sm font-semibold">Guten Appetit! 🎉</span>
        )}
      </div>

      {/* Phasen-Leiste */}
      <div className="px-4 py-3">
        <div className="relative flex items-center justify-between">
          {/* Verbindungslinie */}
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 bg-stone-200 dark:bg-stone-700 z-0" />
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-blue-500 z-0 transition-all duration-700"
            style={{ width: `${Math.min(100, (currentIdx / (PHASES.length - 1)) * 100)}%` }}
          />

          {PHASES.map((phase, idx) => {
            const done = idx < currentIdx;
            const active = idx === currentIdx;
            return (
              <div key={phase.key} className="relative z-10 flex flex-col items-center gap-1">
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-500',
                  done ? 'bg-blue-500 border-blue-500 text-white' :
                    active ? 'bg-white dark:bg-stone-900 border-blue-500 text-blue-600 shadow-lg ring-4 ring-blue-100 dark:ring-blue-900/30' :
                      'bg-white dark:bg-stone-900 border-stone-300 dark:border-stone-600 text-stone-400',
                )}>
                  {done ? <CheckCircle2 className="h-4 w-4" /> : phase.icon}
                </div>
                <span className={cn(
                  'text-[9px] font-semibold text-center leading-tight max-w-[48px]',
                  active ? 'text-blue-600 dark:text-blue-400' : done ? 'text-stone-600 dark:text-stone-400' : 'text-stone-400',
                )}>
                  {phase.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Status-Detail */}
      <div className="px-4 pb-3 space-y-2">
        {/* Aktuelle Phase */}
        {!isDelivered && (
          <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-3 py-2 flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />
            <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">
              {PHASES[currentIdx]?.desc ?? 'Wird vorbereitet'}
            </span>
          </div>
        )}

        {/* Fahrer-Info */}
        {isDelivering && data.fahrer_name && (
          <div className="flex items-center gap-2 text-[11px] text-stone-600 dark:text-stone-400">
            <Bike className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
            <span><strong>{data.fahrer_name}</strong> ist unterwegs zu dir</span>
            {data.fahrer_entfernung_km != null && (
              <span className="ml-auto flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {data.fahrer_entfernung_km.toFixed(1)} km
              </span>
            )}
          </div>
        )}

        {/* ETA */}
        {!isDelivered && data.eta_min != null && (
          <div className="flex items-center gap-2 text-[11px] text-stone-500 dark:text-stone-400">
            <Clock className="h-3.5 w-3.5 flex-shrink-0" />
            <span>Voraussichtliche Lieferung in ca. <strong>{data.eta_min} Minuten</strong></span>
          </div>
        )}
      </div>
    </div>
  );
}
