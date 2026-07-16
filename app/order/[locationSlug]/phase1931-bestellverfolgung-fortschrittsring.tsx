'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { X, PackageCheck } from 'lucide-react';

/**
 * Phase 1931 — Bestellverfolgung-Fortschrittsring (Storefront)
 *
 * Kreisring-Fortschritt (0→25→50→75→100%) mit 4 Phasen:
 * Bestellt/Zubereitung/Unterwegs/Geliefert; animiert; SSR-safe; schließbar.
 */

type BestellPhase = 'bestellt' | 'zubereitung' | 'unterwegs' | 'geliefert';

interface FortschrittDaten {
  phase: BestellPhase;
  phase_index: number;
  fortschritt_pct: number;
}

const PHASEN: { key: BestellPhase; label: string; icon: string }[] = [
  { key: 'bestellt', label: 'Bestellt', icon: '📋' },
  { key: 'zubereitung', label: 'Zubereitung', icon: '👨‍🍳' },
  { key: 'unterwegs', label: 'Unterwegs', icon: '🚴' },
  { key: 'geliefert', label: 'Geliefert', icon: '✅' },
];

interface Props {
  locationId: string;
  orderId?: string | null;
  className?: string;
}

function statusZuPhase(status: string): { phase: BestellPhase; idx: number; pct: number } {
  if (status === 'delivered' || status === 'geliefert') return { phase: 'geliefert', idx: 3, pct: 100 };
  if (status === 'dispatched' || status === 'on_the_way' || status === 'picked_up') return { phase: 'unterwegs', idx: 2, pct: 75 };
  if (status === 'preparing' || status === 'ready' || status === 'in_preparation') return { phase: 'zubereitung', idx: 1, pct: 50 };
  return { phase: 'bestellt', idx: 0, pct: 25 };
}

export function Phase1931BestellverfolgungFortschrittsring({ locationId, orderId, className }: Props) {
  const [daten, setDaten] = useState<FortschrittDaten | null>(null);
  const [geschlossen, setGeschlossen] = useState(false);
  const [gemountet, setGemountet] = useState(false);

  useEffect(() => { setGemountet(true); }, []);

  useEffect(() => {
    if (!gemountet || !orderId) {
      if (gemountet) setDaten({ phase: 'bestellt', phase_index: 0, fortschritt_pct: 25 });
      return;
    }

    const laden = async () => {
      try {
        const res = await fetch(`/api/delivery/public/avg-eta?location_id=${locationId}&order_id=${orderId}`);
        if (!res.ok) throw new Error('API Fehler');
        const json = await res.json();
        const status: string = json.order_status ?? json.status ?? 'pending';
        const { phase, idx, pct } = statusZuPhase(status);
        setDaten({ phase, phase_index: idx, fortschritt_pct: pct });
      } catch {
        setDaten({ phase: 'zubereitung', phase_index: 1, fortschritt_pct: 50 });
      }
    };

    laden();
    const id = setInterval(laden, 20 * 1000);
    return () => clearInterval(id);
  }, [gemountet, locationId, orderId]);

  if (!gemountet || !daten || geschlossen || daten.phase === 'geliefert') return null;

  const circumference = 2 * Math.PI * 38;
  const dashoffset = circumference * (1 - daten.fortschritt_pct / 100);
  const ringKlasse = daten.fortschritt_pct < 50 ? 'stroke-blue-500' : daten.fortschritt_pct < 75 ? 'stroke-amber-500' : 'stroke-green-500';

  return (
    <div className={cn('relative rounded-2xl border bg-card shadow-sm px-4 py-3', className)}>
      <button
        onClick={() => setGeschlossen(true)}
        className="absolute top-2 right-2 rounded-full p-1 hover:bg-muted/40 transition-colors"
        aria-label="Schließen"
      >
        <X className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      <div className="flex items-center gap-4">
        {/* Fortschrittsring */}
        <div className="relative shrink-0">
          <svg width="88" height="88" className="-rotate-90">
            <circle cx="44" cy="44" r="38" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/20" />
            <circle
              cx="44" cy="44" r="38" fill="none" strokeWidth="6"
              strokeDasharray={circumference}
              strokeDashoffset={dashoffset}
              strokeLinecap="round"
              className={ringKlasse}
              style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl">{PHASEN[daten.phase_index].icon}</span>
            <span className="text-[10px] font-bold text-muted-foreground">{daten.fortschritt_pct}%</span>
          </div>
        </div>

        {/* Phasen-Schritte */}
        <div className="flex-1 min-w-0 space-y-1.5">
          {PHASEN.map((p, i) => {
            const done = i <= daten.phase_index;
            const current = i === daten.phase_index;
            return (
              <div key={p.key} className={cn('flex items-center gap-2', done ? 'opacity-100' : 'opacity-30')}>
                <div className={cn(
                  'h-4 w-4 rounded-full flex items-center justify-center text-[10px] shrink-0',
                  current ? 'bg-primary text-primary-foreground' : done ? 'bg-green-500 text-white' : 'bg-muted',
                )}>
                  {done && !current ? '✓' : i + 1}
                </div>
                <span className={cn('text-xs font-semibold', current ? 'text-foreground' : done ? 'text-green-700 dark:text-green-300' : 'text-muted-foreground')}>
                  {p.label}
                </span>
                {current && (
                  <span className="ml-auto text-[10px] font-bold text-primary animate-pulse">Aktuell</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <PackageCheck className="h-3 w-3" />
        <span>Deine Bestellung wird verfolgt · 20-Sek-Polling</span>
      </div>
    </div>
  );
}
