'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, ChefHat, Clock, MapPin, Navigation, Package, Truck, Zap } from 'lucide-react';

/**
 * Phase 997 — Dynamische ETA Live-Cockpit (Storefront)
 *
 * Zeigt Kunden nach Bestellung:
 *   • Live ETA-Countdown mit Phasen-Anzeige
 *   • Fahrer-Annäherungsanzeige (wenn verfügbar)
 *   • Küchen-Status in Echtzeit
 *   • Phasenbasierter Fortschrittsbalken
 */

type OrderPhase = 'confirmed' | 'preparing' | 'ready' | 'picked_up' | 'on_way' | 'nearby' | 'delivered';

const PHASES: { key: OrderPhase; label: string; icon: React.ElementType; minPct: number }[] = [
  { key: 'confirmed', label: 'Bestätigt', icon: CheckCircle2, minPct: 0 },
  { key: 'preparing', label: 'In Zubereitung', icon: ChefHat, minPct: 20 },
  { key: 'ready', label: 'Fertig', icon: Package, minPct: 45 },
  { key: 'picked_up', label: 'Abgeholt', icon: Truck, minPct: 55 },
  { key: 'on_way', label: 'Unterwegs', icon: Navigation, minPct: 70 },
  { key: 'nearby', label: 'Fast da!', icon: MapPin, minPct: 90 },
  { key: 'delivered', label: 'Geliefert', icon: CheckCircle2, minPct: 100 },
];

function phaseIndex(phase: OrderPhase): number {
  return PHASES.findIndex(p => p.key === phase);
}

function progressPct(phase: OrderPhase): number {
  const idx = phaseIndex(phase);
  if (idx < 0) return 0;
  if (idx >= PHASES.length - 1) return 100;
  const current = PHASES[idx];
  const next = PHASES[idx + 1];
  return Math.round((current.minPct + next.minPct) / 2);
}

function formatEta(remainSec: number): string {
  if (remainSec <= 0) return 'Jeden Moment…';
  const m = Math.floor(remainSec / 60);
  const s = remainSec % 60;
  if (m === 0) return `${s} Sek.`;
  return `${m} Min ${s > 0 ? s + ' Sek.' : ''}`;
}

interface EtaData {
  phase: OrderPhase;
  etaMin: number;
  driverName?: string | null;
  driverDistanceM?: number | null;
  orderId?: string | null;
}

interface Props {
  orderId?: string | null;
  locationId?: string | null;
  initialEtaMin?: number;
  className?: string;
}

export function StorefrontPhase997DynamischeEtaLiveCockpit({ orderId, locationId, initialEtaMin = 35, className }: Props) {
  const [data, setData] = useState<EtaData>({
    phase: 'confirmed',
    etaMin: initialEtaMin,
  });
  const [remainSec, setRemainSec] = useState(initialEtaMin * 60);
  const [loading, setLoading] = useState(false);
  const deadlineRef = useRef<Date | null>(null);

  // Set deadline on mount
  useEffect(() => {
    deadlineRef.current = new Date(Date.now() + initialEtaMin * 60_000);
    setRemainSec(initialEtaMin * 60);
  }, [initialEtaMin]);

  // Countdown tick
  useEffect(() => {
    const tick = setInterval(() => {
      if (!deadlineRef.current) return;
      const s = Math.round((deadlineRef.current.getTime() - Date.now()) / 1000);
      setRemainSec(Math.max(0, s));
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  // Poll order status
  useEffect(() => {
    if (!orderId && !locationId) return;

    const poll = async () => {
      try {
        const params = new URLSearchParams();
        if (orderId) params.set('order_id', orderId);
        if (locationId) params.set('location_id', locationId);
        const r = await fetch(`/api/tracking?${params}`, { cache: 'no-store' });
        if (!r.ok) return;
        const d = await r.json();

        const newPhase: OrderPhase = d.phase ?? d.status ?? data.phase;
        const newEtaMin: number = d.eta_min ?? d.remaining_min ?? data.etaMin;

        setData({
          phase: newPhase,
          etaMin: newEtaMin,
          driverName: d.driver_name ?? null,
          driverDistanceM: d.driver_distance_m ?? null,
          orderId,
        });

        // Update deadline
        if (d.eta_min && d.eta_min !== data.etaMin) {
          deadlineRef.current = new Date(Date.now() + d.eta_min * 60_000);
        }
      } catch { /* ignore */ }
    };

    poll();
    const iv = setInterval(poll, 15_000);
    return () => clearInterval(iv);
  }, [orderId, locationId]);

  const pct = progressPct(data.phase);
  const currentPhaseIdx = phaseIndex(data.phase);
  const isDelivered = data.phase === 'delivered';
  const isNearby = data.phase === 'nearby';

  return (
    <div className={cn('rounded-2xl border border-matcha-200 bg-white overflow-hidden shadow-sm', className)}>
      {/* Header */}
      <div className={cn(
        'px-4 py-3 flex items-center gap-3',
        isDelivered ? 'bg-matcha-50' : isNearby ? 'bg-amber-50' : 'bg-matcha-50',
      )}>
        <div className={cn(
          'flex h-10 w-10 items-center justify-center rounded-full shrink-0',
          isDelivered ? 'bg-matcha-500' : isNearby ? 'bg-amber-400' : 'bg-matcha-600',
        )}>
          {isDelivered
            ? <CheckCircle2 className="h-5 w-5 text-white" />
            : isNearby
            ? <MapPin className="h-5 w-5 text-white" />
            : <Truck className="h-5 w-5 text-white" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm text-foreground">
            {isDelivered ? 'Geliefert!' : isNearby ? 'Fahrer ist fast da!' : 'Deine Bestellung'}
          </div>
          {!isDelivered && (
            <div className={cn(
              'font-mono font-black text-xl tabular-nums leading-none mt-0.5',
              isNearby ? 'text-amber-600' : 'text-matcha-700',
            )}>
              {formatEta(remainSec)}
            </div>
          )}
          {isDelivered && (
            <div className="text-sm text-matcha-600 font-bold">Guten Appetit! 🎉</div>
          )}
        </div>
        {!isDelivered && (
          <div className="shrink-0 text-right">
            <div className="text-[10px] text-muted-foreground">ETA</div>
            <div className="font-black text-sm tabular-nums text-foreground">~{data.etaMin} Min</div>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="px-4 pt-2 pb-1">
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-1000',
              isDelivered ? 'bg-matcha-500' : isNearby ? 'bg-amber-400' : 'bg-matcha-500',
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Phase steps */}
      <div className="px-4 pb-3 pt-2">
        <div className="flex items-center gap-0">
          {PHASES.map((phase, idx) => {
            const done = idx < currentPhaseIdx;
            const current = idx === currentPhaseIdx;
            const future = idx > currentPhaseIdx;
            const PhaseIcon = phase.icon;
            const isLast = idx === PHASES.length - 1;

            return (
              <div key={phase.key} className="flex items-center flex-1">
                {/* Icon + label */}
                <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                  <div className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full border-2 transition-all',
                    done ? 'bg-matcha-500 border-matcha-600 text-white' : current ? 'bg-white border-matcha-500 text-matcha-600 shadow-sm' : 'bg-muted border-border text-muted-foreground',
                    current && !isDelivered && 'animate-[pulse_2s_ease-in-out_infinite]',
                  )}>
                    <PhaseIcon className="h-3 w-3" />
                  </div>
                  <span className={cn(
                    'text-[8px] text-center leading-tight max-w-[40px]',
                    done ? 'text-matcha-600 font-bold' : current ? 'text-matcha-700 font-black' : 'text-muted-foreground',
                  )}>
                    {phase.label}
                  </span>
                </div>

                {/* Connector line */}
                {!isLast && (
                  <div className={cn(
                    'flex-1 h-0.5 mb-4',
                    idx < currentPhaseIdx ? 'bg-matcha-400' : 'bg-muted',
                  )} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Driver info */}
      {data.driverName && !isDelivered && (
        <div className="border-t px-4 py-2.5 flex items-center gap-3 bg-blue-50/50">
          <Truck className="h-3.5 w-3.5 text-blue-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-xs font-bold">{data.driverName}</span>
            <span className="text-[10px] text-muted-foreground"> ist auf dem Weg</span>
          </div>
          {data.driverDistanceM && (
            <span className="text-[10px] font-bold text-blue-600 shrink-0">
              ~{data.driverDistanceM >= 1000
                ? `${(data.driverDistanceM / 1000).toFixed(1)} km`
                : `${Math.round(data.driverDistanceM)} m`} entfernt
            </span>
          )}
        </div>
      )}

      {/* Pulsing indicator */}
      {!isDelivered && (
        <div className="border-t px-4 py-2 flex items-center gap-2">
          <div className="relative">
            <div className="h-2 w-2 rounded-full bg-matcha-500" />
            <div className="absolute inset-0 h-2 w-2 rounded-full bg-matcha-400 animate-ping opacity-75" />
          </div>
          <span className="text-[10px] text-muted-foreground">Live-Tracking aktiv · aktualisiert alle 15s</span>
        </div>
      )}
    </div>
  );
}
