'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ChefHat, Clock, Package, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1399 — Bestellstatus-Live-Ticker (Storefront)
 *
 * Schmaler Fortschritts-Strip für aktive Bestellungen:
 *   • 4-Phasen-Ticker: Eingegangen → Zubereitung → Bereit → Unterwegs
 *   • Sekunden-genauer ETA-Countdown
 *   • Aktive Phase pulsiert
 *   • 30-Sek-Polling auf /api/delivery/customer/tracking
 *   • Verschwindet automatisch nach Lieferung
 *
 * Nach Phase1394 in storefront.tsx einbinden.
 */

const PHASEN = [
  { key: 'neu',            label: 'Eingegangen',  icon: Package    },
  { key: 'angenommen',     label: 'Angenommen',   icon: CheckCircle2 },
  { key: 'in_zubereitung', label: 'Zubereitung',  icon: ChefHat    },
  { key: 'fertig',         label: 'Bereit',       icon: Package    },
  { key: 'unterwegs',      label: 'Unterwegs',    icon: Truck      },
  { key: 'geliefert',      label: 'Geliefert',    icon: CheckCircle2 },
] as const;

type PhaseKey = typeof PHASEN[number]['key'];

function phaseIndex(status: string): number {
  const idx = PHASEN.findIndex((p) => p.key === status);
  return idx >= 0 ? idx : 0;
}

function formatCountdown(sek: number): string {
  if (sek <= 0) return 'Gleich da!';
  const m = Math.floor(sek / 60);
  const s = sek % 60;
  if (m === 0) return `${s}s`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

interface TrackingData {
  status: string;
  etaMin: number | null;
}

interface Props {
  orderId: string;
  locationId: string;
  initialStatus?: string;
  initialEtaMin?: number;
}

export function StorefrontPhase1399BestellstatusLiveTicker({ orderId, locationId, initialStatus = 'neu', initialEtaMin }: Props) {
  const [status, setStatus] = useState<string>(initialStatus);
  const [etaSek, setEtaSek] = useState<number | null>(initialEtaMin != null ? initialEtaMin * 60 : null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/delivery/customer/tracking?order_id=${orderId}&location_id=${locationId}`);
        if (!res.ok) return;
        const data: TrackingData = await res.json();
        if (cancelled) return;
        setStatus(data.status);
        if (data.etaMin != null) setEtaSek(data.etaMin * 60);
      } catch {
        // keep last state
      }
    };

    poll();
    const pollInterval = setInterval(poll, 30_000);
    return () => { cancelled = true; clearInterval(pollInterval); };
  }, [orderId, locationId]);

  useEffect(() => {
    if (etaSek === null || etaSek <= 0) return;
    tickRef.current = setInterval(() => {
      setEtaSek((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [etaSek !== null && etaSek > 0]);

  if (status === 'geliefert') return null;

  const currentIdx = phaseIndex(status);
  const visiblePhasen = PHASEN.filter((p) => p.key !== 'geliefert');

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 dark:bg-primary/10 px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <Clock className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-semibold text-primary">Ihre Bestellung</span>
        {etaSek !== null && etaSek > 0 && (
          <span className="ml-auto text-sm font-bold text-primary font-mono">
            {formatCountdown(etaSek)}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1">
        {visiblePhasen.map((phase, i) => {
          const isDone = i < currentIdx;
          const isActive = i === currentIdx;
          const Icon = phase.icon;

          return (
            <div key={phase.key} className="flex items-center flex-1">
              <div className="flex flex-col items-center gap-1 flex-1">
                <div className={cn(
                  'flex items-center justify-center w-7 h-7 rounded-full border-2 transition-all duration-300',
                  isDone  ? 'bg-green-500 border-green-500 text-white' :
                  isActive ? 'bg-primary border-primary text-primary-foreground animate-pulse' :
                  'bg-background border-muted text-muted-foreground'
                )}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <span className={cn(
                  'text-[9px] leading-tight text-center font-medium',
                  isDone || isActive ? 'text-foreground' : 'text-muted-foreground'
                )}>
                  {phase.label}
                </span>
              </div>
              {i < visiblePhasen.length - 1 && (
                <div className={cn(
                  'h-0.5 flex-1 mx-0.5 rounded transition-all duration-300',
                  i < currentIdx ? 'bg-green-500' : 'bg-muted'
                )} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
