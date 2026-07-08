'use client';

/**
 * Phase 684 — Dynamische ETA-Anzeige
 * Zeigt eine live aktualisierte Lieferzeitschätzung mit Konfidenzband und Phasen-Indikator.
 * Props: orderId: string, locationId: string
 */

import React, { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Clock, Bike, ChefHat, Package, CheckCircle2 } from 'lucide-react';

type EtaPhase = 'waiting' | 'cooking' | 'ready' | 'on_route' | 'arriving' | 'delivered';

type EtaData = {
  phase: EtaPhase;
  etaMin: number | null;
  etaMinLow: number | null;
  etaMinHigh: number | null;
  lastUpdate: string;
  driverName?: string | null;
  driverDistance?: number | null;
};

const PHASE_INFO: Record<EtaPhase, { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
  waiting:   { label: 'Bestellung eingegangen',     icon: Package,      color: 'text-muted-foreground',            bgColor: 'bg-muted/30' },
  cooking:   { label: 'Wird zubereitet',            icon: ChefHat,      color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-50 dark:bg-orange-950/20' },
  ready:     { label: 'Fertig — wartet auf Fahrer', icon: Package,      color: 'text-amber-600 dark:text-amber-400',   bgColor: 'bg-amber-50 dark:bg-amber-950/20' },
  on_route:  { label: 'Fahrer ist unterwegs',       icon: Bike,         color: 'text-blue-600 dark:text-blue-400',     bgColor: 'bg-blue-50 dark:bg-blue-950/20' },
  arriving:  { label: 'Fahrer kommt gleich!',       icon: Bike,         color: 'text-matcha-600 dark:text-matcha-400', bgColor: 'bg-matcha-50 dark:bg-matcha-950/20' },
  delivered: { label: 'Geliefert — Guten Appetit!', icon: CheckCircle2, color: 'text-matcha-600 dark:text-matcha-400', bgColor: 'bg-matcha-50 dark:bg-matcha-950/20' },
};

const PHASE_ORDER: EtaPhase[] = ['waiting', 'cooking', 'ready', 'on_route', 'arriving', 'delivered'];

export function Phase684DynamischeEtaAnzeige({
  orderId,
  locationId,
}: {
  orderId: string;
  locationId: string;
}) {
  const [eta, setEta] = useState<EtaData | null>(null);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/delivery/customer/order-eta?order_id=${orderId}&location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (!res.ok) return;
      const data = await res.json() as EtaData;
      setEta(data);
    } catch {
      // API nicht verfügbar
    }
  }, [orderId, locationId]);

  useEffect(() => {
    load();
    const pollId = setInterval(load, 30_000);
    const tickId = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => { clearInterval(pollId); clearInterval(tickId); };
  }, [load]);

  if (!eta) return null;

  const info = PHASE_INFO[eta.phase];
  const Icon = info.icon;
  const phaseIdx = PHASE_ORDER.indexOf(eta.phase);

  return (
    <div className={cn('rounded-2xl p-5 space-y-4 border', info.bgColor)}>
      {/* Status-Header */}
      <div className="flex items-center gap-3">
        <div className={cn('flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center border-2', info.bgColor,
          eta.phase === 'arriving' ? 'animate-pulse' : '',
        )}>
          <Icon className={cn('h-5 w-5', info.color)} />
        </div>
        <div>
          <p className={cn('font-bold text-sm', info.color)}>{info.label}</p>
          {eta.driverName && (
            <p className="text-xs text-muted-foreground">Fahrer: {eta.driverName}</p>
          )}
        </div>
        {eta.lastUpdate && (
          <span className="ml-auto text-[10px] text-muted-foreground">
            Aktualisiert {new Date(eta.lastUpdate).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {/* ETA-Anzeige */}
      {eta.etaMin !== null && eta.phase !== 'delivered' && (
        <div className="text-center py-2">
          <div className={cn('text-5xl font-black tabular-nums', info.color)}>
            {eta.etaMin}
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            Minuten geschätzte Lieferzeit
          </div>
          {eta.etaMinLow != null && eta.etaMinHigh != null && (
            <div className="text-xs text-muted-foreground mt-0.5">
              Spanne: {eta.etaMinLow}–{eta.etaMinHigh} Min
            </div>
          )}
          {eta.driverDistance != null && (
            <div className="text-xs text-muted-foreground mt-1">
              <Bike className="inline h-3 w-3 mr-1" />
              Fahrer noch {eta.driverDistance.toFixed(1)} km entfernt
            </div>
          )}
        </div>
      )}

      {/* Phasen-Fortschrittsleiste */}
      <div className="space-y-1.5">
        <div className="flex justify-between mb-1">
          {PHASE_ORDER.slice(0, -1).map((phase, idx) => {
            const pi = PHASE_INFO[phase];
            const isActive = idx === phaseIdx;
            const isDone = idx < phaseIdx;
            return (
              <div key={phase} className="flex flex-col items-center gap-0.5 flex-1">
                <div className={cn(
                  'h-2 w-2 rounded-full border transition',
                  isDone ? 'bg-matcha-500 border-matcha-500' :
                  isActive ? cn('border-2', info.color.replace('text-', 'border-'), 'bg-current') :
                  'border-muted-foreground/40 bg-background',
                  isActive && 'scale-125',
                )} />
              </div>
            );
          })}
        </div>
        <div className="flex">
          {PHASE_ORDER.slice(0, -1).map((phase, idx) => (
            <div
              key={phase}
              className={cn(
                'h-1 flex-1 transition-all duration-700',
                idx === 0 ? 'rounded-l-full' : '',
                idx === PHASE_ORDER.length - 2 ? 'rounded-r-full' : '',
                idx < phaseIdx ? 'bg-matcha-500' : idx === phaseIdx ? 'bg-current opacity-50' : 'bg-muted',
              )}
            />
          ))}
        </div>
        <div className="flex justify-between text-[9px] text-muted-foreground px-0.5">
          <span>Eingang</span>
          <span>Küche</span>
          <span>Abholbereit</span>
          <span>Unterwegs</span>
          <span>Ankunft</span>
        </div>
      </div>
    </div>
  );
}
