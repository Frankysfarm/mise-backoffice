'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Check, ChefHat, MapPin, Navigation, Package, Truck } from 'lucide-react';

/**
 * Phase 985 — Live-ETA-Tracking-Banner (Storefront)
 *
 * Dynamischer Banner mit Sekunden-genauem ETA-Countdown + Phasen-Fortschritt
 * (Küche → Fertig → Unterwegs → Angekommen). Kein API-Call, client-seitig.
 * Pulsierender Tracking-Punkt, Farbwechsel je aktive Phase.
 */

type OrderStatus =
  | 'neu' | 'bestätigt' | 'accepted' | 'confirmed'
  | 'in_zubereitung' | 'zubereitung' | 'preparing' | 'in_preparation'
  | 'fertig' | 'ready' | 'bereit'
  | 'abgeholt' | 'dispatched' | 'unterwegs' | 'in_delivery'
  | 'geliefert' | 'delivered' | 'angekommen';

interface Phase {
  key: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  statuses: string[];
}

const PHASEN: Phase[] = [
  {
    key: 'kueche',
    label: 'Küche',
    icon: <ChefHat className="h-4 w-4" />,
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-950/20',
    borderColor: 'border-orange-200 dark:border-orange-800',
    statuses: ['neu', 'bestätigt', 'accepted', 'confirmed', 'in_zubereitung', 'zubereitung', 'preparing', 'in_preparation'],
  },
  {
    key: 'fertig',
    label: 'Fertig',
    icon: <Package className="h-4 w-4" />,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
    statuses: ['fertig', 'ready', 'bereit'],
  },
  {
    key: 'unterwegs',
    label: 'Unterwegs',
    icon: <Truck className="h-4 w-4" />,
    color: 'text-violet-600 dark:text-violet-400',
    bgColor: 'bg-violet-50 dark:bg-violet-950/20',
    borderColor: 'border-violet-200 dark:border-violet-800',
    statuses: ['abgeholt', 'dispatched', 'unterwegs', 'in_delivery'],
  },
  {
    key: 'angekommen',
    label: 'Angekommen',
    icon: <MapPin className="h-4 w-4" />,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/20',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
    statuses: ['geliefert', 'delivered', 'angekommen'],
  },
];

function getActivePhase(status: string): Phase {
  return PHASEN.find(p => p.statuses.includes(status)) ?? PHASEN[0];
}

function getPhaseIndex(status: string): number {
  return PHASEN.findIndex(p => p.statuses.includes(status));
}

interface Props {
  orderId?: string | null;
  status?: string | null;
  etaMinutes?: number | null;
  driverName?: string | null;
  estimatedAt?: string | null;
  className?: string;
}

export function Phase985LiveEtaTrackingBanner({
  orderId,
  status = 'in_zubereitung',
  etaMinutes,
  driverName,
  estimatedAt,
  className,
}: Props) {
  const [remainSec, setRemainSec] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const safeStatus = status ?? 'in_zubereitung';
  const activePhase = getActivePhase(safeStatus);
  const activeIdx = getPhaseIndex(safeStatus);
  const delivered = activeIdx >= 3;

  useEffect(() => {
    // Berechne Sekunden bis ETA
    let deadline: number | null = null;
    if (estimatedAt) {
      deadline = new Date(estimatedAt).getTime();
    } else if (etaMinutes != null && etaMinutes > 0) {
      deadline = Date.now() + etaMinutes * 60_000;
    }

    if (!deadline) {
      setRemainSec(null);
      return;
    }

    function tick() {
      if (!deadline) return;
      const diff = Math.max(0, Math.round((deadline - Date.now()) / 1_000));
      setRemainSec(diff);
    }

    tick();
    timerRef.current = setInterval(tick, 1_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [estimatedAt, etaMinutes]);

  if (!status) return null;

  const mins = remainSec !== null ? Math.floor(remainSec / 60) : null;
  const secs = remainSec !== null ? remainSec % 60 : null;

  return (
    <div
      className={cn(
        'rounded-xl border overflow-hidden transition-all duration-500',
        delivered ? 'border-emerald-300 dark:border-emerald-700' : activePhase.borderColor,
        className,
      )}
      data-storefront-phase="985"
    >
      {/* Farbiger Header */}
      <div className={cn(
        'flex items-center gap-3 px-4 py-3 border-b transition-colors duration-500',
        delivered ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800' : activePhase.bgColor,
        delivered ? '' : activePhase.borderColor.replace('border-', 'border-b-'),
      )}>
        {/* Pulsierender Live-Dot */}
        {!delivered && (
          <span className="relative shrink-0">
            <span className={cn(
              'absolute inline-flex h-3 w-3 rounded-full opacity-75 animate-ping',
              activeIdx === 2 ? 'bg-violet-400' : activeIdx === 1 ? 'bg-blue-400' : 'bg-orange-400',
            )} />
            <span className={cn(
              'relative inline-flex h-3 w-3 rounded-full',
              activeIdx === 2 ? 'bg-violet-500' : activeIdx === 1 ? 'bg-blue-500' : 'bg-orange-500',
            )} />
          </span>
        )}
        {delivered && <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />}

        <span className={cn(
          'font-bold text-sm flex-1',
          delivered ? 'text-emerald-700 dark:text-emerald-300' : activePhase.color,
        )}>
          {delivered ? '🎉 Bestellung angekommen!' : `Live-Tracking · ${activePhase.label}`}
        </span>

        {/* ETA-Countdown */}
        {!delivered && mins !== null && secs !== null && (
          <div className={cn('text-right shrink-0', activePhase.color)}>
            <div className="text-lg font-black tabular-nums leading-none">
              {mins}:{String(secs).padStart(2, '0')}
            </div>
            <div className="text-[9px] text-muted-foreground">verbleibend</div>
          </div>
        )}
        {!delivered && mins === null && etaMinutes && (
          <div className={cn('text-right shrink-0', activePhase.color)}>
            <div className="text-lg font-black">~{etaMinutes} Min</div>
          </div>
        )}
      </div>

      {/* Phasen-Fortschritts-Strip */}
      <div className="px-4 py-3 bg-card">
        <div className="flex items-center">
          {PHASEN.map((p, idx) => {
            const isActive = idx === activeIdx;
            const isDone = idx < activeIdx || delivered;
            const isLast = idx === PHASEN.length - 1;

            return (
              <div key={p.key} className="flex items-center flex-1 last:flex-none">
                {/* Schritt-Icon */}
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500',
                    isDone || (delivered && idx === PHASEN.length - 1)
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : isActive
                      ? cn(p.bgColor.replace('dark:', ''), 'border-2', p.borderColor, p.color)
                      : 'bg-muted text-muted-foreground/40',
                  )}>
                    {isDone ? <Check className="h-4 w-4" /> : (
                      <span className={isActive ? p.color : 'text-muted-foreground/40'}>{p.icon}</span>
                    )}
                  </div>
                  <span className={cn(
                    'text-[9px] font-bold text-center leading-tight max-w-[44px] text-center',
                    isActive ? p.color : isDone ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground/50',
                  )}>
                    {p.label}
                  </span>
                </div>

                {/* Verbindungslinie */}
                {!isLast && (
                  <div className={cn(
                    'flex-1 h-0.5 mx-1 rounded-full transition-all duration-500',
                    idx < activeIdx ? 'bg-emerald-400' : 'bg-muted',
                  )} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Fahrer-Info (wenn unterwegs) */}
      {activeIdx === 2 && driverName && (
        <div className="px-4 pb-3 flex items-center gap-2 text-xs text-muted-foreground border-t">
          <Navigation className="h-3.5 w-3.5 text-violet-500 shrink-0" />
          <span className="font-medium">{driverName}</span>
          <span>ist auf dem Weg zu dir</span>
        </div>
      )}
    </div>
  );
}
