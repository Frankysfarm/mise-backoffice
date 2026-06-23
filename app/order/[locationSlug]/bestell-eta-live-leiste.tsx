'use client';

/**
 * BestellEtaLiveLeiste — dynamische ETA-Leiste für die Bestellbestätigungsseite.
 *
 * Zeigt:
 *   - Phasen-Fortschritts-Leiste (Eingegangen → Zubereitung → Unterwegs → Geliefert)
 *   - Live-Countdown bis zur Lieferung
 *   - Fahrer-Näherungs-Indikator (wenn Tracking-Daten verfügbar)
 *   - Dynamische Farbgebung nach verbleibender Zeit
 *
 * Props: orderId (optional, für Polling), status, etaMin, bestelltAm
 * Polling alle 30s auf /api/delivery/tracking/[orderId] falls orderId übergeben.
 */

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChefHat, Clock, MapPin, Package, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TrackingState {
  status: string;
  etaMin: number | null;
  driverName: string | null;
  driverNearby: boolean;
  phase: number;
}

const PHASES = [
  { key: 'neu',            label: 'Eingegangen',    icon: Package  },
  { key: 'bestätigt',      label: 'Angenommen',     icon: CheckCircle2 },
  { key: 'in_zubereitung', label: 'In Zubereitung', icon: ChefHat  },
  { key: 'fertig',         label: 'Fertig',         icon: Package  },
  { key: 'unterwegs',      label: 'Unterwegs',      icon: Truck    },
  { key: 'geliefert',      label: 'Geliefert',      icon: MapPin   },
] as const;

function statusToPhase(status: string): number {
  const idx = PHASES.findIndex((p) => p.key === status);
  return idx >= 0 ? idx : 0;
}

function formatCountdown(remainMin: number): string {
  if (remainMin <= 0) return 'Gleich da';
  if (remainMin === 1) return 'ca. 1 Minute';
  return `ca. ${remainMin} Minuten`;
}

interface Props {
  orderId?: string;
  initialStatus?: string;
  initialEtaMin?: number | null;
  bestelltAm?: string | null;
  className?: string;
}

export function BestellEtaLiveLeiste({
  orderId,
  initialStatus = 'neu',
  initialEtaMin = null,
  bestelltAm,
  className,
}: Props) {
  const [tracking, setTracking] = useState<TrackingState>({
    status: initialStatus,
    etaMin: initialEtaMin,
    driverName: null,
    driverNearby: false,
    phase: statusToPhase(initialStatus),
  });
  const [tick, setTick] = useState(0);

  // Sekundentakt für Countdown
  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(iv);
  }, []);

  // Polling für Live-Updates
  useEffect(() => {
    if (!orderId) return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/delivery/tracking/${orderId}`);
        if (!res.ok) return;
        const data = await res.json();
        setTracking({
          status: data.status ?? initialStatus,
          etaMin: data.eta_min ?? null,
          driverName: data.driver_name ?? null,
          driverNearby: data.driver_nearby ?? false,
          phase: statusToPhase(data.status ?? initialStatus),
        });
      } catch {
        // Stille Fehlerbehandlung bei Netzwerkproblemen
      }
    };
    poll();
    const iv = setInterval(poll, 30_000);
    return () => clearInterval(iv);
  }, [orderId, initialStatus]);

  const remainMin = useMemo(() => {
    if (tracking.etaMin == null) return null;
    if (!bestelltAm) return tracking.etaMin;
    const elapsedMin = Math.floor((Date.now() - new Date(bestelltAm).getTime()) / 60_000);
    return Math.max(0, tracking.etaMin - elapsedMin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracking.etaMin, bestelltAm, tick]);

  const isDelivered = tracking.status === 'geliefert' || tracking.status === 'abgeholt';
  const isOnTheWay = tracking.status === 'unterwegs' || tracking.status === 'in_lieferung';

  const countdownColor =
    remainMin === null ? 'text-muted-foreground' :
    remainMin <= 5 ? 'text-red-600' :
    remainMin <= 10 ? 'text-amber-600' : 'text-matcha-700';

  const barColor =
    isDelivered ? 'bg-matcha-500' :
    isOnTheWay ? 'bg-blue-500' :
    tracking.status === 'in_zubereitung' ? 'bg-amber-400' : 'bg-matcha-500';

  const progressPct = Math.min(100, (tracking.phase / (PHASES.length - 1)) * 100);

  return (
    <div className={cn('rounded-2xl border bg-white overflow-hidden', className)}>
      {/* Header */}
      <div className={cn(
        'px-4 py-3 flex items-center gap-3',
        isDelivered ? 'bg-matcha-50 border-b border-matcha-100' :
        isOnTheWay ? 'bg-blue-50 border-b border-blue-100' :
        'bg-amber-50 border-b border-amber-100',
      )}>
        {/* Status-Icon */}
        <div className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
          isDelivered ? 'bg-matcha-500 text-white' :
          isOnTheWay ? 'bg-blue-500 text-white' :
          'bg-amber-400 text-white',
        )}>
          {isDelivered ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : isOnTheWay ? (
            <Truck className="h-5 w-5" />
          ) : (
            <ChefHat className="h-5 w-5" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Status-Text */}
          <div className="font-bold text-foreground text-sm">
            {isDelivered
              ? 'Geliefert 🎉'
              : isOnTheWay
              ? 'Fahrer ist unterwegs'
              : tracking.status === 'in_zubereitung'
              ? 'Wird zubereitet…'
              : 'Bestätigt'}
          </div>

          {/* ETA */}
          {!isDelivered && remainMin !== null && (
            <div className={cn('text-xs font-bold tabular-nums mt-0.5', countdownColor)}>
              {formatCountdown(remainMin)}
            </div>
          )}
          {!isDelivered && remainMin === null && (
            <div className="text-xs text-muted-foreground mt-0.5">
              <Clock className="h-3 w-3 inline mr-0.5" />
              Berechne ETA…
            </div>
          )}
        </div>

        {/* Fahrername */}
        {tracking.driverName && isOnTheWay && (
          <div className="text-[10px] text-right text-muted-foreground shrink-0">
            <div className="font-bold text-foreground">{tracking.driverName}</div>
            <div>Fahrer</div>
          </div>
        )}
      </div>

      {/* Fortschritts-Leiste */}
      <div className="px-4 py-3">
        <div className="relative h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={cn('absolute inset-y-0 left-0 rounded-full transition-all duration-1000', barColor)}
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Phase-Labels */}
        <div className="mt-3 grid grid-cols-4 gap-1">
          {['Eingegangen', 'Zubereitung', 'Unterwegs', 'Geliefert'].map((label, i) => {
            const phaseThresholds = [0, 2, 4, 5];
            const isDone = tracking.phase >= phaseThresholds[i];
            const isCurrent =
              tracking.phase >= phaseThresholds[i] &&
              (i === 3 || tracking.phase < phaseThresholds[i + 1]);

            return (
              <div key={label} className="flex flex-col items-center gap-1 text-center">
                <div className={cn(
                  'h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors',
                  isDone
                    ? 'border-matcha-500 bg-matcha-500'
                    : isCurrent
                    ? 'border-matcha-400 bg-matcha-100'
                    : 'border-muted-foreground/20 bg-transparent',
                )}>
                  {isDone && <CheckCircle2 className="h-3 w-3 text-white" />}
                  {!isDone && isCurrent && (
                    <div className="h-2 w-2 rounded-full bg-matcha-400 animate-pulse" />
                  )}
                </div>
                <span className={cn(
                  'text-[9px] font-medium leading-tight',
                  isDone ? 'text-matcha-700' :
                  isCurrent ? 'text-foreground font-bold' :
                  'text-muted-foreground',
                )}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fahrer-Näherungs-Alert */}
      {tracking.driverNearby && !isDelivered && (
        <div className="mx-4 mb-3 flex items-center gap-2 rounded-xl bg-blue-50 border border-blue-200 px-3 py-2">
          <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
          <span className="text-xs font-bold text-blue-800">
            Fahrer ist in der Nähe — bitte bereit sein!
          </span>
        </div>
      )}
    </div>
  );
}
