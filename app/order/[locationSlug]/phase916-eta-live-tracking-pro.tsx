'use client';

import { useEffect, useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Clock, MapPin, CheckCircle2, ChefHat, Bike, Package } from 'lucide-react';

/**
 * Phase 916 — ETA Live Tracking Pro (Storefront)
 *
 * Dynamische ETA-Anzeige mit Live-Tracking für Kunden:
 * - Fortschritts-Timeline: Bestellt → Küche → Unterwegs → Geliefert
 * - Countdown bis Lieferung
 * - Fahrer-Annäherungsanzeige
 * SSE-fähig, Fallback: Polling alle 30 s
 */

type OrderPhase = 'confirmed' | 'cooking' | 'ready' | 'picked_up' | 'delivered';

interface Props {
  orderId?: string;
  initialEtaMin?: number;
  initialPhase?: OrderPhase;
  driverName?: string;
}

interface TrackingData {
  phase: OrderPhase;
  eta_min: number;
  driver_name?: string;
  driver_distance_m?: number;
  kitchen_progress_pct?: number;
}

const PHASES: { key: OrderPhase; label: string; icon: React.ReactNode }[] = [
  { key: 'confirmed', label: 'Bestätigt', icon: <Package className="h-4 w-4" /> },
  { key: 'cooking', label: 'Zubereitung', icon: <ChefHat className="h-4 w-4" /> },
  { key: 'picked_up', label: 'Unterwegs', icon: <Bike className="h-4 w-4" /> },
  { key: 'delivered', label: 'Geliefert', icon: <CheckCircle2 className="h-4 w-4" /> },
];

const PHASE_ORDER: OrderPhase[] = ['confirmed', 'cooking', 'ready', 'picked_up', 'delivered'];

function phaseIndex(phase: OrderPhase): number {
  return PHASE_ORDER.indexOf(phase);
}

function displayPhaseIndex(phase: OrderPhase): number {
  // Map internal phases to display steps
  if (phase === 'confirmed') return 0;
  if (phase === 'cooking' || phase === 'ready') return 1;
  if (phase === 'picked_up') return 2;
  if (phase === 'delivered') return 3;
  return 0;
}

export function StorefrontPhase916EtaLiveTrackingPro({
  orderId,
  initialEtaMin = 28,
  initialPhase = 'cooking',
  driverName,
}: Props) {
  const [data, setData] = useState<TrackingData>({
    phase: initialPhase,
    eta_min: initialEtaMin,
    driver_name: driverName,
  });
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Countdown tick every second
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setElapsed((e) => e + 1);
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Polling for updates
  useEffect(() => {
    if (!orderId) return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/delivery/tracking/${orderId}`, { cache: 'no-store' });
        if (!res.ok) return;
        const json: TrackingData = await res.json();
        setData(json);
      } catch {
        // silently fail
      }
    };
    poll();
    const id = setInterval(poll, 30_000);
    return () => clearInterval(id);
  }, [orderId]);

  const remainSec = Math.max(0, data.eta_min * 60 - elapsed);
  const remainMin = Math.floor(remainSec / 60);
  const remainSecDisplay = remainSec % 60;
  const currentDisplayStep = displayPhaseIndex(data.phase);
  const isDelivered = data.phase === 'delivered';
  const driverNear = data.driver_distance_m !== undefined && data.driver_distance_m < 300;

  return (
    <div className="rounded-2xl border border-border bg-background overflow-hidden shadow-sm">
      {/* ETA Header */}
      <div className={cn(
        'px-5 py-4 text-center border-b',
        isDelivered ? 'bg-matcha-50 dark:bg-matcha-950/40' : 'bg-background',
      )}>
        {isDelivered ? (
          <div className="flex flex-col items-center gap-2">
            <CheckCircle2 className="h-10 w-10 text-matcha-500" />
            <div className="text-xl font-black text-matcha-700 dark:text-matcha-300">Geliefert!</div>
            <div className="text-sm text-muted-foreground">Guten Appetit!</div>
          </div>
        ) : (
          <>
            <div className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">
              Geschätzte Lieferzeit
            </div>
            <div className={cn(
              'font-mono text-4xl font-black tabular-nums',
              remainMin <= 5
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-matcha-700 dark:text-matcha-300',
            )}>
              {remainMin.toString().padStart(2, '0')}:{remainSecDisplay.toString().padStart(2, '0')}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {remainMin === 0 ? 'Gleich da!' : `noch ca. ${remainMin} Min`}
            </div>

            {driverNear && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900/40 border border-amber-300 px-3 py-1 text-xs font-bold text-amber-700 dark:text-amber-300">
                <MapPin className="h-3 w-3" />
                Fahrer ist ganz nah!
              </div>
            )}
          </>
        )}
      </div>

      {/* Phase Timeline */}
      <div className="px-5 py-4">
        <div className="flex items-start gap-0">
          {PHASES.map((phase, idx) => {
            const isDone = idx < currentDisplayStep;
            const isCurrent = idx === currentDisplayStep;
            const isPending = idx > currentDisplayStep;

            return (
              <div key={phase.key} className="flex-1 flex flex-col items-center gap-1">
                {/* Line + Circle Row */}
                <div className="w-full flex items-center">
                  {/* Left line */}
                  <div className={cn(
                    'flex-1 h-0.5 transition-colors',
                    idx === 0 ? 'opacity-0' : isDone || isCurrent ? 'bg-matcha-400' : 'bg-border',
                  )} />
                  {/* Circle */}
                  <div className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all shrink-0',
                    isDone
                      ? 'border-matcha-400 bg-matcha-500 text-white'
                      : isCurrent
                      ? 'border-matcha-400 bg-white dark:bg-background text-matcha-600 dark:text-matcha-400 shadow-sm shadow-matcha-200'
                      : 'border-border bg-muted/30 text-muted-foreground',
                    isCurrent && 'ring-2 ring-matcha-200 dark:ring-matcha-800',
                  )}>
                    {isDone ? <CheckCircle2 className="h-4 w-4" /> : phase.icon}
                  </div>
                  {/* Right line */}
                  <div className={cn(
                    'flex-1 h-0.5 transition-colors',
                    idx === PHASES.length - 1 ? 'opacity-0' : isDone ? 'bg-matcha-400' : 'bg-border',
                  )} />
                </div>
                {/* Label */}
                <span className={cn(
                  'text-[9px] font-semibold text-center leading-tight px-0.5',
                  isDone ? 'text-matcha-600 dark:text-matcha-400'
                    : isCurrent ? 'text-matcha-700 dark:text-matcha-300 font-black'
                    : 'text-muted-foreground',
                )}>
                  {phase.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Driver Info */}
      {data.driver_name && !isDelivered && (
        <div className="px-5 pb-4">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 p-3">
            <div className="h-9 w-9 rounded-full bg-matcha-100 dark:bg-matcha-900/30 flex items-center justify-center shrink-0">
              <Bike className="h-4 w-4 text-matcha-600 dark:text-matcha-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-foreground">{data.driver_name}</div>
              <div className="text-[11px] text-muted-foreground">
                {data.phase === 'picked_up' ? 'Ist unterwegs zu dir' : 'Bringt deine Bestellung bald'}
              </div>
            </div>
            {data.driver_distance_m !== undefined && (
              <div className="text-right shrink-0">
                <div className="text-sm font-black tabular-nums text-foreground">
                  {data.driver_distance_m >= 1000
                    ? `${(data.driver_distance_m / 1000).toFixed(1)} km`
                    : `${data.driver_distance_m} m`}
                </div>
                <div className="text-[9px] text-muted-foreground">entfernt</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Kitchen progress (while cooking) */}
      {(data.phase === 'cooking' || data.phase === 'ready') && (
        <div className="px-5 pb-4">
          <div className="flex items-center gap-2 mb-1">
            <ChefHat className="h-3.5 w-3.5 text-matcha-600 shrink-0" />
            <span className="text-[11px] font-bold text-foreground">Küche bereitet vor</span>
            {data.kitchen_progress_pct !== undefined && (
              <span className="ml-auto text-[10px] font-black text-matcha-700 dark:text-matcha-300 tabular-nums">
                {data.kitchen_progress_pct}%
              </span>
            )}
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-matcha-500 transition-all duration-1000"
              style={{ width: `${data.kitchen_progress_pct ?? (data.phase === 'ready' ? 100 : 60)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
