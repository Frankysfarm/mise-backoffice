'use client';

import { useCallback, useEffect, useState } from 'react';
import { X, Package, ChefHat, Bike, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1138 — Lieferstatus-Live-Banner (Storefront)
// Fixierter Bottom-Banner nach Bestellabschluss: 4-Stufen-Timeline mit 20s-Polling

interface Props {
  orderId: string;
  bestellnummer: string;
  orderedAt: string;
  etaMinutes: number;
  locationId: string;
}

type StatusPhase = 'bestaetigt' | 'zubereitung' | 'unterwegs' | 'geliefert';

const PHASES: Array<{ key: StatusPhase; label: string; Icon: React.ElementType }> = [
  { key: 'bestaetigt', label: 'Bestätigt',   Icon: Package },
  { key: 'zubereitung', label: 'Zubereitung', Icon: ChefHat },
  { key: 'unterwegs',  label: 'Unterwegs',   Icon: Bike },
  { key: 'geliefert',  label: 'Geliefert',   Icon: CheckCircle },
];

const ORDER_STATUS_MAP: Record<string, StatusPhase> = {
  confirmed:  'bestaetigt',
  preparing:  'zubereitung',
  ready:      'zubereitung',
  picked_up:  'unterwegs',
  on_the_way: 'unterwegs',
  delivered:  'geliefert',
};

function phaseFromElapsed(elapsedMin: number, etaMin: number): StatusPhase {
  const pct = elapsedMin / Math.max(etaMin, 1);
  if (pct >= 1) return 'geliefert';
  if (pct >= 0.6) return 'unterwegs';
  if (pct >= 0.15) return 'zubereitung';
  return 'bestaetigt';
}

const PHASE_INDEX: Record<StatusPhase, number> = {
  bestaetigt: 0, zubereitung: 1, unterwegs: 2, geliefert: 3,
};

const PHASE_COLORS: Record<StatusPhase, string> = {
  bestaetigt: 'bg-violet-500',
  zubereitung: 'bg-amber-500',
  unterwegs:  'bg-blue-500',
  geliefert:  'bg-emerald-500',
};

export function Phase1138LieferstatusBanner({ orderId, bestellnummer, orderedAt, etaMinutes, locationId }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<StatusPhase>('bestaetigt');
  const [elapsedMin, setElapsedMin] = useState(0);
  const [remainMin, setRemainMin] = useState(etaMinutes);

  const poll = useCallback(async () => {
    const now = Date.now();
    const elapsed = Math.floor((now - new Date(orderedAt).getTime()) / 60_000);
    setElapsedMin(elapsed);
    setRemainMin(Math.max(0, etaMinutes - elapsed));

    if (orderId) {
      try {
        const res = await fetch(`/api/delivery/order-status?order_id=${encodeURIComponent(orderId)}&location_id=${encodeURIComponent(locationId)}`);
        if (res.ok) {
          const json = await res.json();
          const mapped = ORDER_STATUS_MAP[json.status as string];
          if (mapped) { setCurrentPhase(mapped); return; }
        }
      } catch { /* fallback to time-based */ }
    }
    setCurrentPhase(phaseFromElapsed(elapsed, etaMinutes));
  }, [orderId, orderedAt, etaMinutes, locationId]);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 20_000);
    return () => clearInterval(id);
  }, [poll]);

  if (dismissed || currentPhase === 'geliefert') {
    if (currentPhase === 'geliefert') {
      return (
        <div className="fixed bottom-4 left-4 right-4 z-50 rounded-2xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/80 shadow-xl px-5 py-4 flex items-center gap-3">
          <CheckCircle className="h-6 w-6 text-emerald-500 shrink-0" />
          <div className="flex-1">
            <div className="font-bold text-emerald-800 dark:text-emerald-200 text-sm">Geliefert! Guten Appetit 🎉</div>
            <div className="text-[10px] text-muted-foreground">Bestellung #{bestellnummer}</div>
          </div>
          <button onClick={() => setDismissed(true)} className="text-muted-foreground p-1 hover:text-foreground" aria-label="Schließen">
            <X className="h-4 w-4" />
          </button>
        </div>
      );
    }
    return null;
  }

  const currentIdx = PHASE_INDEX[currentPhase];
  const barColor = PHASE_COLORS[currentPhase];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur shadow-xl px-4 py-3">
      {/* Header row */}
      <div className="flex items-center justify-between mb-2.5">
        <div>
          <span className="font-bold text-sm text-foreground">Bestellung #{bestellnummer}</span>
          <span className="text-[10px] text-muted-foreground ml-2">
            {currentPhase === 'unterwegs'
              ? `~${remainMin} Min bis Lieferung`
              : `ETA ca. ${remainMin} Min`}
          </span>
        </div>
        <button onClick={() => setDismissed(true)} className="text-muted-foreground p-1 hover:text-foreground" aria-label="Schließen">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Fortschritts-Balken */}
      <div className="w-full h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden mb-3">
        <div
          className={cn('h-full rounded-full transition-all duration-700', barColor)}
          style={{ width: `${((currentIdx + 1) / PHASES.length) * 100}%` }}
        />
      </div>

      {/* Schritt-Icons */}
      <div className="flex items-center justify-between">
        {PHASES.map((phase, idx) => {
          const done = idx <= currentIdx;
          const active = idx === currentIdx;
          return (
            <div key={phase.key} className="flex flex-col items-center gap-1 flex-1">
              <div className={cn(
                'rounded-full p-1.5 transition-all duration-300',
                done
                  ? active
                    ? `${barColor} text-white scale-110 shadow-md`
                    : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                  : 'bg-black/5 dark:bg-white/5 text-muted-foreground'
              )}>
                <phase.Icon className="h-3.5 w-3.5" />
              </div>
              <span className={cn(
                'text-[9px] font-medium text-center leading-tight',
                active ? 'text-foreground font-bold' : done ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
              )}>
                {phase.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
