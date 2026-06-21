'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  ChefHat,
  Bike,
  Clock,
  CheckCircle2,
  MapPin,
  Package,
  Zap,
  Navigation,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  orderId: string;
  estimatedMinutes?: number; // initial ETA in minutes
  locationSlug: string;
}

type OrderStatus =
  | 'neu'
  | 'bestätigt'
  | 'in_zubereitung'
  | 'fertig'
  | 'wartet_auf_fahrer'
  | 'unterwegs'
  | 'fast_da'
  | 'geliefert';

interface OrderData {
  status: OrderStatus;
  eta_min: number | null;
  driver_name: string | null;
  driver_distance_km: number | null;
  bestellt_am: string | null;
  geschaetzte_lieferung_min: number | null;
}

// ---------------------------------------------------------------------------
// Phase configuration
// ---------------------------------------------------------------------------

type Phase = 1 | 2 | 3 | 4 | 5 | 6;

interface PhaseConfig {
  phase: Phase;
  label: string;
  subLabel?: string;
  icon: React.ElementType;
  pulse: boolean;
  progressPercent: number; // how full the bar should be (0-100)
}

const STATUS_TO_PHASE: Record<OrderStatus, Phase> = {
  neu:               1,
  bestätigt:         1,
  in_zubereitung:    2,
  fertig:            3,
  wartet_auf_fahrer: 3,
  unterwegs:         4,
  fast_da:           5,
  geliefert:         6,
};

const PHASE_CONFIG: Record<Phase, PhaseConfig> = {
  1: {
    phase: 1,
    label: 'Bestätigt',
    subLabel: 'Küche wird informiert...',
    icon: CheckCircle2,
    pulse: false,
    progressPercent: 10,
  },
  2: {
    phase: 2,
    label: 'Wird zubereitet',
    subLabel: 'Deine Bestellung ist in der Küche',
    icon: ChefHat,
    pulse: false,
    progressPercent: 35,
  },
  3: {
    phase: 3,
    label: 'Fahrer holt ab',
    subLabel: 'Bestellung ist fertig – Fahrer kommt',
    icon: Package,
    pulse: false,
    progressPercent: 55,
  },
  4: {
    phase: 4,
    label: 'Unterwegs zu dir!',
    subLabel: 'Dein Essen ist auf dem Weg',
    icon: Bike,
    pulse: false,
    progressPercent: 75,
  },
  5: {
    phase: 5,
    label: 'Fast da!',
    subLabel: 'Weniger als 5 Minuten',
    icon: Navigation,
    pulse: true,
    progressPercent: 92,
  },
  6: {
    phase: 6,
    label: 'Geliefert! Guten Appetit 🍕',
    subLabel: undefined,
    icon: CheckCircle2,
    pulse: false,
    progressPercent: 100,
  },
};

// The 5 timeline dots (phases 1–5)
const TIMELINE_PHASES: Phase[] = [1, 2, 3, 4, 5];
const TIMELINE_ICONS: Record<Phase, React.ElementType> = {
  1: CheckCircle2,
  2: ChefHat,
  3: Package,
  4: Bike,
  5: Navigation,
  6: CheckCircle2,
};
const TIMELINE_LABELS: Record<Phase, string> = {
  1: 'Bestätigt',
  2: 'Zubereitung',
  3: 'Abholung',
  4: 'Unterwegs',
  5: 'Fast da',
  6: 'Geliefert',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCountdown(secs: number): { mins: string; s: string } {
  const m = Math.max(0, Math.floor(secs / 60));
  const s = Math.max(0, secs % 60);
  return { mins: String(m).padStart(2, '0'), s: String(s).padStart(2, '0') };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LiveEtaRealtime({ orderId, estimatedMinutes, locationSlug: _locationSlug }: Props) {
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusChanged, setStatusChanged] = useState(false);
  const [countdownSec, setCountdownSec] = useState<number | null>(
    estimatedMinutes != null ? estimatedMinutes * 60 : null,
  );

  const prevStatusRef = useRef<OrderStatus | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------

  const fetchOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/delivery/orders/${orderId}/tracking`, { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      setOrderData({
        status: json.status ?? 'bestätigt',
        eta_min: json.eta_min ?? json.etaMin ?? null,
        driver_name: json.driver_name ?? json.driverName ?? null,
        driver_distance_km: json.driver_distance_km ?? json.driverDistanceKm ?? null,
        bestellt_am: json.bestellt_am ?? json.createdAt ?? null,
        geschaetzte_lieferung_min: json.geschaetzte_lieferung_min ?? estimatedMinutes ?? null,
      });
    } catch {
      // silently ignore – realtime will update
    } finally {
      setLoading(false);
    }
  }, [orderId, estimatedMinutes]);

  // -------------------------------------------------------------------------
  // Supabase realtime subscription + polling fallback
  // -------------------------------------------------------------------------

  useEffect(() => {
    fetchOrder();

    const supabase = createClient();

    const channel = supabase
      .channel(`live-eta-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'customer_orders',
          filter: `id=eq.${orderId}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          const row = payload.new as Partial<OrderData & { id: string }>;
          setOrderData((prev) => ({
            status: (row.status as OrderStatus) ?? prev?.status ?? 'bestätigt',
            eta_min: row.eta_min ?? prev?.eta_min ?? null,
            driver_name: row.driver_name ?? prev?.driver_name ?? null,
            driver_distance_km: row.driver_distance_km ?? prev?.driver_distance_km ?? null,
            bestellt_am: row.bestellt_am ?? prev?.bestellt_am ?? null,
            geschaetzte_lieferung_min:
              row.geschaetzte_lieferung_min ?? prev?.geschaetzte_lieferung_min ?? null,
          }));
        },
      )
      .subscribe();

    // Polling fallback every 30 s
    pollIntervalRef.current = setInterval(fetchOrder, 30_000);

    return () => {
      supabase.removeChannel(channel);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [orderId, fetchOrder]);

  // -------------------------------------------------------------------------
  // Pulse animation on status change
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!orderData) return;
    if (prevStatusRef.current !== null && prevStatusRef.current !== orderData.status) {
      setStatusChanged(true);
      const t = setTimeout(() => setStatusChanged(false), 1200);
      return () => clearTimeout(t);
    }
    prevStatusRef.current = orderData.status;
  }, [orderData?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // -------------------------------------------------------------------------
  // Countdown timer
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    if (!orderData) return;
    if (orderData.status === 'geliefert') {
      setCountdownSec(0);
      return;
    }

    // Derive target timestamp
    let targetSec: number | null = null;

    if (orderData.bestellt_am && orderData.geschaetzte_lieferung_min) {
      const targetMs =
        new Date(orderData.bestellt_am).getTime() +
        orderData.geschaetzte_lieferung_min * 60_000;
      targetSec = Math.max(0, Math.floor((targetMs - Date.now()) / 1000));
    } else if (orderData.eta_min != null) {
      targetSec = orderData.eta_min * 60;
    } else if (estimatedMinutes != null) {
      targetSec = estimatedMinutes * 60;
    }

    if (targetSec == null) return;

    setCountdownSec(targetSec);

    countdownIntervalRef.current = setInterval(() => {
      setCountdownSec((prev) => {
        if (prev == null || prev <= 0) return 0;
        return prev - 1;
      });
    }, 1_000);

    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [orderData?.status, orderData?.eta_min, orderData?.bestellt_am, orderData?.geschaetzte_lieferung_min, estimatedMinutes]); // eslint-disable-line react-hooks/exhaustive-deps

  // -------------------------------------------------------------------------
  // Derived state
  // -------------------------------------------------------------------------

  const status: OrderStatus = orderData?.status ?? 'bestätigt';
  const phase: Phase = STATUS_TO_PHASE[status] ?? 1;
  const cfg = PHASE_CONFIG[phase];
  const PhaseIcon = cfg.icon;

  const isDelivered = phase === 6;
  const isNearby = phase === 5;
  const isOnTheWay = phase === 4 || phase === 5;
  const showCountdown = isOnTheWay && countdownSec != null && countdownSec > 0;
  const countdown = countdownSec != null ? formatCountdown(countdownSec) : null;

  const initialTotalSec =
    (orderData?.geschaetzte_lieferung_min ?? estimatedMinutes ?? 30) * 60;
  const barPercent = isDelivered
    ? 100
    : countdownSec != null
    ? Math.max(cfg.progressPercent, Math.min(99, 100 - (countdownSec / initialTotalSec) * 100))
    : cfg.progressPercent;

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="rounded-2xl border border-matcha-200 bg-matcha-50/60 p-4 flex items-center gap-3 text-sm text-matcha-700 animate-pulse">
        <Clock className="h-4 w-4 shrink-0" />
        <span>Bestellstatus wird geladen…</span>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Delivered state
  // -------------------------------------------------------------------------

  if (isDelivered) {
    return (
      <div className="rounded-2xl border-2 border-matcha-400 bg-matcha-50 p-5 flex flex-col items-center gap-3 text-center shadow-sm">
        <CheckCircle2 className="h-10 w-10 text-matcha-500" />
        <div>
          <p className="text-lg font-black text-matcha-800">Geliefert! Guten Appetit 🍕</p>
          <p className="text-sm text-matcha-600 mt-0.5">Deine Bestellung ist angekommen.</p>
        </div>
        {/* Full progress bar */}
        <div className="w-full h-2 rounded-full bg-matcha-100 overflow-hidden">
          <div className="h-full w-full bg-matcha-500 rounded-full" />
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Main render
  // -------------------------------------------------------------------------

  return (
    <div
      className={cn(
        'rounded-2xl border-2 overflow-hidden shadow-sm transition-all duration-500',
        statusChanged && 'animate-pulse',
        isNearby
          ? 'border-matcha-400 bg-matcha-50'
          : isOnTheWay
          ? 'border-matcha-300 bg-white'
          : 'border-matcha-200 bg-white',
      )}
    >
      {/* ── Header ── */}
      <div className="flex items-start gap-3 px-4 pt-4 pb-3">
        {/* Phase icon */}
        <div
          className={cn(
            'h-10 w-10 rounded-full flex items-center justify-center shrink-0',
            isNearby
              ? 'bg-matcha-500 text-white animate-pulse'
              : 'bg-matcha-100 text-matcha-700',
          )}
        >
          <PhaseIcon className="h-5 w-5" />
        </div>

        {/* Phase text */}
        <div className="flex-1 min-w-0 pt-0.5">
          <p
            className={cn(
              'text-sm font-black leading-tight',
              isNearby ? 'text-matcha-800' : 'text-foreground',
            )}
          >
            {cfg.label}
          </p>
          {cfg.subLabel && (
            <p className="text-xs text-muted-foreground mt-0.5">{cfg.subLabel}</p>
          )}
        </div>

        {/* Large countdown for delivery phase */}
        {showCountdown && countdown && (
          <div
            className={cn(
              'shrink-0 rounded-xl border-2 px-3 py-1.5 flex flex-col items-center justify-center',
              isNearby
                ? 'border-matcha-500 bg-matcha-500 text-white'
                : 'border-matcha-300 bg-matcha-50 text-matcha-700',
            )}
          >
            <span className="font-mono text-2xl font-black tabular-nums leading-none">
              {countdown.mins}
              <span
                className={cn(
                  'text-base font-black',
                  isNearby && 'animate-pulse',
                )}
              >
                :
              </span>
              {countdown.s}
            </span>
            <span className="text-[9px] mt-0.5 font-medium uppercase tracking-wider opacity-70">
              Min verbleibend
            </span>
          </div>
        )}

        {/* Zap icon for fast_da when no countdown */}
        {isNearby && !showCountdown && (
          <Zap className="h-6 w-6 text-matcha-500 animate-pulse shrink-0 mt-1" />
        )}
      </div>

      {/* ── Driver chip (unterwegs / fast_da) ── */}
      {isOnTheWay && orderData?.driver_name && (
        <div className="mx-4 mb-3 flex items-center gap-2 rounded-xl bg-matcha-50 border border-matcha-200 px-3 py-2">
          <Bike className="h-4 w-4 text-matcha-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-xs font-bold text-matcha-800">
              Fahrer: {orderData.driver_name}
            </span>
            {orderData.driver_distance_km != null && (
              <span className="ml-2 text-[10px] text-matcha-600">
                <MapPin className="inline h-3 w-3 mr-0.5" />
                {orderData.driver_distance_km < 1
                  ? `${Math.round(orderData.driver_distance_km * 1000)} m entfernt`
                  : `${orderData.driver_distance_km.toFixed(1)} km entfernt`}
              </span>
            )}
            {orderData.eta_min != null && orderData.driver_distance_km == null && (
              <span className="ml-2 text-[10px] text-matcha-600">
                ~{orderData.eta_min} Min
              </span>
            )}
          </div>
          <Navigation className="h-3.5 w-3.5 text-matcha-500 shrink-0" />
        </div>
      )}

      {/* ── 5-dot progress timeline ── */}
      <div className="px-4 pb-3">
        <div className="relative flex items-center justify-between">
          {/* Connecting line */}
          <div className="absolute inset-x-3 top-3 h-0.5 bg-matcha-100" />
          <div
            className="absolute left-3 top-3 h-0.5 bg-matcha-500 transition-all duration-700"
            style={{
              width: `calc(${Math.min(100, ((phase - 1) / (TIMELINE_PHASES.length - 1)) * 100)}% - 0px)`,
            }}
          />

          {TIMELINE_PHASES.map((p) => {
            const DotIcon = TIMELINE_ICONS[p];
            const done = phase > p;
            const active = phase === p;
            return (
              <div key={p} className="flex flex-col items-center gap-1 z-10">
                <div
                  className={cn(
                    'h-6 w-6 rounded-full flex items-center justify-center border-2 transition-all duration-300 bg-white',
                    done
                      ? 'border-matcha-500 bg-matcha-500 text-white'
                      : active
                      ? 'border-matcha-500 bg-white text-matcha-600 scale-110 shadow-sm'
                      : 'border-matcha-200 text-matcha-300',
                  )}
                >
                  {done ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <DotIcon className="h-3 w-3" />
                  )}
                </div>
                <span
                  className={cn(
                    'text-[8px] text-center leading-tight whitespace-nowrap',
                    done ? 'text-matcha-600 font-bold' :
                    active ? 'text-matcha-700 font-black' :
                    'text-matcha-300',
                  )}
                >
                  {TIMELINE_LABELS[p]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Color-coded progress bar ── */}
      <div className="h-2 bg-matcha-100">
        <div
          className={cn(
            'h-full transition-all duration-1000 ease-in-out',
            isNearby ? 'bg-matcha-500 animate-pulse' : 'bg-matcha-400',
          )}
          style={{ width: `${barPercent}%` }}
        />
      </div>
    </div>
  );
}

export default LiveEtaRealtime;
