'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ShieldCheck, Gift, Timer } from 'lucide-react';

/**
 * Phase 1671 — Liefer-Garantie-Timer (Storefront)
 *
 * Countdown bis Max-ETA (45 Min nach Bestellung).
 * Wenn überschritten: automatischer Rabatt-Badge.
 * Hydration-safe: nur clientseitig gerendert.
 */

interface Props {
  orderedAt?: string | null;
  maxMinutes?: number;
  rabattPct?: number;
}

const DEFAULT_MAX = 45;
const DEFAULT_RABATT = 10;

function calcRemaining(orderedAt: string, maxMinutes: number): number {
  const deadline = new Date(orderedAt).getTime() + maxMinutes * 60 * 1000;
  return Math.floor((deadline - Date.now()) / 1000);
}

function fmt(secs: number): string {
  const m = Math.floor(Math.abs(secs) / 60);
  const s = Math.abs(secs) % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function StorefrontPhase1671LieferGarantieTimer({
  orderedAt,
  maxMinutes = DEFAULT_MAX,
  rabattPct = DEFAULT_RABATT,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [remaining, setRemaining] = useState<number>(maxMinutes * 60);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !orderedAt) return;
    setRemaining(calcRemaining(orderedAt, maxMinutes));

    const iv = setInterval(() => {
      setRemaining(calcRemaining(orderedAt, maxMinutes));
    }, 1000);

    return () => clearInterval(iv);
  }, [mounted, orderedAt, maxMinutes]);

  if (!mounted) return null;
  if (!orderedAt) return null;

  const overtime = remaining < 0;
  const urgency = !overtime && remaining < 5 * 60;

  const pct = Math.max(0, Math.min(100, Math.round((remaining / (maxMinutes * 60)) * 100)));

  if (overtime) {
    return (
      <div className="rounded-xl border border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 p-3 mb-3">
        <div className="flex items-center gap-2 mb-2">
          <Gift className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="text-sm font-bold text-amber-700 dark:text-amber-300">
            Liefer-Garantie: {rabattPct}% Rabatt auf deine nächste Bestellung!
          </span>
        </div>
        <p className="text-[11px] text-amber-600 dark:text-amber-400">
          Deine Bestellung hat die garantierte Lieferzeit von {maxMinutes} Min überschritten.
          Als Entschuldigung erhältst du einen Rabatt-Code bei der nächsten Bestellung.
        </p>
        <div className="mt-2 rounded bg-amber-100 dark:bg-amber-800/30 border border-amber-200 dark:border-amber-700 px-3 py-1.5 text-center">
          <span className="text-sm font-mono font-bold text-amber-700 dark:text-amber-300 tracking-widest">
            GARANTIE{rabattPct}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      'rounded-xl border p-3 mb-3',
      urgency
        ? 'border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20'
        : 'border-border bg-card'
    )}>
      <div className="flex items-center gap-2 mb-2">
        <ShieldCheck className={cn('h-4 w-4 shrink-0', urgency ? 'text-amber-500' : 'text-matcha-500')} />
        <span className="text-sm font-semibold flex-1 text-foreground">
          Liefer-Garantie
        </span>
        <div className="flex items-center gap-1">
          <Timer className={cn('h-3.5 w-3.5', urgency ? 'text-amber-500' : 'text-muted-foreground')} />
          <span className={cn('text-sm font-mono font-bold tabular-nums', urgency ? 'text-amber-600 dark:text-amber-400' : 'text-foreground')}>
            {fmt(remaining)}
          </span>
        </div>
      </div>

      {/* Fortschrittsbalken */}
      <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-2">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-1000',
            urgency ? 'bg-amber-400' : 'bg-matcha-400'
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="text-[10px] text-muted-foreground">
        {urgency
          ? `Noch ${fmt(remaining)} Min bis zur garantierten Lieferzeit. Fast da!`
          : `Garantierte Lieferzeit: max. ${maxMinutes} Min. Bei Überschreitung: ${rabattPct}% Rabatt.`}
      </p>
    </div>
  );
}
