'use client';

/**
 * DynamischeEtaBand — Phase 405
 * Dynamisches ETA-Fortschrittsband für die Storefront-Bestellbestätigungs-Seite.
 * Zeigt den Lieferstatus als fließende Progress-Bar mit Phasen-Labels.
 * Aktualisiert sich alle 30 Sekunden via polling.
 */

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChefHat, CheckCircle2, Clock, MapPin, Package, Truck, Zap } from 'lucide-react';

type OrderStatus =
  | 'bestätigt'
  | 'in_zubereitung'
  | 'fertig'
  | 'unterwegs'
  | 'geliefert'
  | string;

interface Phase {
  status: OrderStatus;
  label: string;
  sublabel: string;
  icon: React.ElementType;
  progress: number; // 0-100 for progress bar
}

const PHASES: Phase[] = [
  { status: 'bestätigt',      label: 'Angenommen',   sublabel: 'Deine Bestellung wurde angenommen', icon: CheckCircle2, progress: 10 },
  { status: 'in_zubereitung', label: 'In Zubereitung', sublabel: 'Das Team bereitet deine Bestellung zu', icon: ChefHat, progress: 35 },
  { status: 'fertig',         label: 'Bereit',         sublabel: 'Bereit zur Abholung durch den Fahrer', icon: Package, progress: 60 },
  { status: 'unterwegs',      label: 'Unterwegs',      sublabel: 'Dein Fahrer ist auf dem Weg zu dir',  icon: Truck, progress: 85 },
  { status: 'geliefert',      label: 'Geliefert',      sublabel: 'Guten Appetit!',                      icon: Zap, progress: 100 },
];

function getPhaseIndex(status: OrderStatus): number {
  const idx = PHASES.findIndex((p) => p.status === status);
  return idx === -1 ? 0 : idx;
}

function useOrderStatus(orderId: string | undefined, initialStatus: OrderStatus) {
  const [status, setStatus] = useState<OrderStatus>(initialStatus);
  const [etaMin, setEtaMin] = useState<number | null>(null);
  const [driverName, setDriverName] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!orderId) return;

    async function poll() {
      try {
        const res = await fetch(`/api/delivery/orders/${orderId}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (data.status) setStatus(data.status);
        if (data.eta_latest) {
          const mins = Math.max(0, Math.round((new Date(data.eta_latest).getTime() - Date.now()) / 60_000));
          setEtaMin(mins);
        }
        if (data.driver_name) setDriverName(data.driver_name);
      } catch {
        // silent — polling only
      }
    }

    poll();
    intervalRef.current = setInterval(poll, 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [orderId]);

  return { status, etaMin, driverName };
}

function formatEta(mins: number | null): string {
  if (mins === null) return '';
  if (mins <= 0) return 'gleich da';
  if (mins === 1) return 'ca. 1 Min';
  return `ca. ${mins} Min`;
}

interface Props {
  orderId?: string;
  bestellnummer: string;
  initialStatus?: OrderStatus;
  initialEtaMin?: number | null;
  isDelivery: boolean;
}

export function DynamischeEtaBand({
  orderId,
  bestellnummer,
  initialStatus = 'bestätigt',
  initialEtaMin = null,
  isDelivery,
}: Props) {
  const { status, etaMin, driverName } = useOrderStatus(orderId, initialStatus);

  if (!isDelivery) return null;

  const phaseIndex = getPhaseIndex(status);
  const currentPhase = PHASES[phaseIndex];
  const progressPct = currentPhase.progress;
  const isDelivered = status === 'geliefert';

  const displayEta = etaMin ?? initialEtaMin;

  return (
    <div className={cn(
      'rounded-2xl border overflow-hidden',
      isDelivered
        ? 'bg-matcha-900 border-matcha-700'
        : 'bg-gradient-to-br from-matcha-900 to-matcha-800 border-matcha-700',
    )}>
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <currentPhase.icon size={16} className={isDelivered ? 'text-matcha-300' : 'text-accent'} />
            <span className="text-sm font-bold text-white">{currentPhase.label}</span>
          </div>
          <p className="text-xs text-matcha-300 mt-0.5">{currentPhase.sublabel}</p>
        </div>
        {!isDelivered && displayEta !== null && (
          <div className="text-right">
            <div className="text-lg font-bold text-accent tabular-nums">{formatEta(displayEta)}</div>
            <div className="text-[10px] text-matcha-400">ETA</div>
          </div>
        )}
        {isDelivered && (
          <CheckCircle2 size={24} className="text-matcha-400" />
        )}
      </div>

      {/* Progress Bar */}
      <div className="px-4 pb-1">
        <div className="h-1.5 bg-matcha-700 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-700 ease-out',
              isDelivered ? 'bg-matcha-400' : 'bg-accent',
            )}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Phase Steps */}
      <div className="px-4 py-3 grid grid-cols-5 gap-1">
        {PHASES.map((phase, idx) => {
          const isDone = idx < phaseIndex;
          const isActive = idx === phaseIndex;
          return (
            <div key={phase.status} className="flex flex-col items-center gap-1">
              <div className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center transition-all',
                isDone   ? 'bg-matcha-500 scale-90' :
                isActive ? 'bg-accent scale-110 shadow-lg shadow-accent/30' :
                           'bg-matcha-700',
              )}>
                <phase.icon
                  size={12}
                  className={cn(
                    isDone   ? 'text-white' :
                    isActive ? 'text-matcha-900' :
                               'text-matcha-500',
                  )}
                />
              </div>
              <span className={cn(
                'text-[9px] text-center leading-tight',
                isActive ? 'text-white font-semibold' : 'text-matcha-500',
              )}>
                {phase.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Driver info (if on route) */}
      {status === 'unterwegs' && (
        <div className="mx-4 mb-3 px-3 py-2 rounded-xl bg-matcha-800/60 border border-matcha-700 flex items-center gap-2">
          <Truck size={14} className="text-accent shrink-0" />
          <div className="text-xs text-matcha-200">
            {driverName ? (
              <><span className="font-semibold text-white">{driverName}</span> · bringt Bestellung #{bestellnummer}</>
            ) : (
              <>Fahrer bringt Bestellung #{bestellnummer}</>
            )}
          </div>
          {displayEta !== null && displayEta > 0 && (
            <div className="ml-auto text-xs font-bold text-accent">{formatEta(displayEta)}</div>
          )}
        </div>
      )}
    </div>
  );
}
