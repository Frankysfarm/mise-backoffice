'use client';

// Phase 1275 — Mindestbestellwert-Progress-Bar (Storefront)
// Farbiger Fortschrittsbalken: Betrag bis Mindestbestellwert + Freischalts-Animation bei Erreichen
// Props: subtotal · minOrder · rein client-seitig (keine API)

import { useEffect, useState } from 'react';
import { ShoppingBag, CheckCircle, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  subtotal: number;
  minOrder: number;
}

export function Phase1275MindestbestellwertProgress({ subtotal, minOrder }: Props) {
  const [freigeschaltet, setFreigeschaltet] = useState(false);
  const [animiert, setAnimiert] = useState(false);

  const erreicht = subtotal >= minOrder;
  const pct = Math.min(100, (subtotal / Math.max(minOrder, 0.01)) * 100);
  const fehlend = Math.max(0, minOrder - subtotal);

  // Trigger Freischalts-Animation
  useEffect(() => {
    if (erreicht && !freigeschaltet) {
      setFreigeschaltet(true);
      setAnimiert(true);
      const t = setTimeout(() => setAnimiert(false), 2000);
      return () => clearTimeout(t);
    }
    if (!erreicht) setFreigeschaltet(false);
  }, [erreicht, freigeschaltet]);

  if (subtotal <= 0 && !erreicht) return null;

  const barFarbe = erreicht
    ? 'bg-green-500'
    : pct >= 75
    ? 'bg-amber-500'
    : pct >= 40
    ? 'bg-matcha-500'
    : 'bg-stone-300 dark:bg-stone-600';

  const textFarbe = erreicht
    ? 'text-green-700 dark:text-green-400'
    : pct >= 75
    ? 'text-amber-700 dark:text-amber-400'
    : 'text-stone-600 dark:text-stone-300';

  const fmt = (v: number) =>
    v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

  return (
    <div className={cn('rounded-2xl border overflow-hidden transition-all duration-300',
      erreicht
        ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/30'
        : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900',
      animiert && 'ring-2 ring-green-400 ring-offset-1 scale-[1.01]'
    )}>
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {erreicht
              ? <CheckCircle className={cn('h-4 w-4', textFarbe)} />
              : <ShoppingBag className={cn('h-4 w-4', textFarbe)} />
            }
            <span className={cn('text-xs font-bold', textFarbe)}>
              {erreicht
                ? `Mindestbestellwert erreicht!`
                : `Noch ${fmt(fehlend)} bis Mindestbestellwert`
              }
            </span>
          </div>
          <span className="text-[11px] text-stone-400 dark:text-stone-500 font-medium">
            {fmt(subtotal)} / {fmt(minOrder)}
          </span>
        </div>

        {/* Fortschrittsbalken */}
        <div className="relative h-2.5 w-full rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-500 ease-out', barFarbe)}
            style={{ width: `${pct}%` }}
          />
          {animiert && (
            <div className="absolute inset-0 animate-pulse bg-green-300/40 rounded-full" />
          )}
        </div>

        {/* Hinweis bei fast erreicht */}
        {!erreicht && pct >= 75 && (
          <div className="mt-2 flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
            <ChevronRight className="h-3 w-3" />
            Fast da — nur noch {fmt(fehlend)}!
          </div>
        )}
        {erreicht && animiert && (
          <div className="mt-2 text-[11px] text-green-600 dark:text-green-400 font-bold animate-bounce text-center">
            Bestellung freigeschalten!
          </div>
        )}
      </div>
    </div>
  );
}
