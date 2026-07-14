'use client';

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, ChefHat, Clock, Bike, Package, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';

// Phase 1454 — Bestellstatus-Live-Tracker (Storefront)
// Animierter Phasen-Tracker: Bestellt → Küche → Fertig → Unterwegs → Geliefert

interface Props {
  orderId?: string | null;
  locationId: string;
  orderStatus?: string | null;
  orderedAt?: string | null;
  estimatedMinutes?: number | null;
}

const PHASES = [
  { key: 'pending',     label: 'Bestellt',    icon: Package,    minutes: 0  },
  { key: 'preparing',   label: 'In Zubereitung', icon: ChefHat, minutes: 5  },
  { key: 'ready',       label: 'Fertig',      icon: CheckCircle2, minutes: 15 },
  { key: 'delivering',  label: 'Unterwegs',   icon: Bike,       minutes: 20 },
  { key: 'delivered',   label: 'Geliefert',   icon: CheckCircle2, minutes: 30 },
] as const;

function getPhaseIndex(status: string | null | undefined): number {
  if (!status) return 0;
  const s = status.toLowerCase();
  if (s.includes('deliver') || s === 'unterwegs') return 3;
  if (s === 'ready' || s === 'fertig') return 2;
  if (s.includes('prepar') || s === 'in_zubereitung' || s === 'preparing') return 1;
  if (s === 'completed' || s === 'geliefert') return 4;
  return 0;
}

function useCountdown(orderedAt: string | null | undefined, totalMin: number) {
  const [remainSec, setRemainSec] = useState<number | null>(null);

  useEffect(() => {
    if (!orderedAt) { setRemainSec(null); return; }
    const target = new Date(orderedAt).getTime() + totalMin * 60 * 1000;
    const tick = () => setRemainSec(Math.max(0, Math.floor((target - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [orderedAt, totalMin]);

  return remainSec;
}

function formatCountdown(sec: number): string {
  if (sec <= 0) return 'Gleich da!';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function BestellstatusLiveTracker({
  orderId, locationId, orderStatus, orderedAt, estimatedMinutes = 30,
}: Props) {
  const phaseIdx = getPhaseIndex(orderStatus);
  const remainSec = useCountdown(orderedAt, estimatedMinutes ?? 30);
  const isDelivered = phaseIdx >= 4;

  if (!orderStatus || orderStatus === 'cancelled') return null;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-matcha-50">
        <Bike className="h-4 w-4 text-matcha-600" />
        <span className="font-display text-sm font-bold text-matcha-700">Deine Bestellung</span>
        {!isDelivered && remainSec !== null && (
          <span className="ml-auto font-mono text-sm font-black text-matcha-600">
            {formatCountdown(remainSec)}
          </span>
        )}
        {isDelivered && (
          <span className="ml-auto text-xs font-bold text-matcha-600">Geliefert!</span>
        )}
      </div>

      <div className="px-4 py-4">
        {/* Step Indicator */}
        <div className="relative flex items-start justify-between">
          {/* Background line */}
          <div className="absolute top-4 left-4 right-4 h-0.5 bg-muted -z-0" />
          {/* Progress line */}
          <div
            className="absolute top-4 left-4 h-0.5 bg-matcha-500 transition-all duration-700 -z-0"
            style={{ width: `${(phaseIdx / (PHASES.length - 1)) * (100 - (100 / PHASES.length))}%` }}
          />

          {PHASES.map((phase, i) => {
            const Icon = phase.icon;
            const done = i < phaseIdx;
            const active = i === phaseIdx;
            const pending = i > phaseIdx;

            return (
              <div key={phase.key} className="flex flex-col items-center gap-1.5 z-10">
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-500',
                  done
                    ? 'bg-matcha-500 border-matcha-500 text-white'
                    : active
                    ? 'bg-white border-matcha-500 text-matcha-600 shadow-md'
                    : 'bg-white border-muted text-muted-foreground',
                )}>
                  {active && !done ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Icon className="h-3.5 w-3.5" />
                  )}
                </div>
                <span className={cn(
                  'text-[9px] font-bold text-center leading-tight max-w-[48px]',
                  done ? 'text-matcha-600' : active ? 'text-foreground' : 'text-muted-foreground',
                )}>
                  {phase.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* ETA info */}
        {!isDelivered && remainSec !== null && remainSec > 0 && (
          <div className="mt-4 rounded-xl bg-matcha-50 border border-matcha-200 px-3 py-2 flex items-center gap-2">
            <Clock className="h-4 w-4 text-matcha-600 shrink-0" />
            <div>
              <div className="text-xs font-bold text-matcha-700">
                Geschätzte Ankunft in ca. {Math.ceil(remainSec / 60)} Min
              </div>
              <div className="text-[10px] text-matcha-600 mt-0.5">
                Wir halten dich auf dem Laufenden
              </div>
            </div>
          </div>
        )}

        {isDelivered && (
          <div className="mt-4 rounded-xl bg-matcha-50 border border-matcha-200 px-3 py-2 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-matcha-600 shrink-0" />
            <div>
              <div className="text-xs font-bold text-matcha-700">Deine Bestellung ist angekommen!</div>
              <div className="text-[10px] text-matcha-600 mt-0.5">Guten Appetit!</div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
