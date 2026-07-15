'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, AlertTriangle } from 'lucide-react';

/**
 * Phase 1706 — Lieferzeit-Garantie-Countdown-Badge (Storefront)
 *
 * Dynamischer Countdown bis Max-Lieferzeit (45 Min) ab Bestelleingang.
 * Roter Badge bei <10 Min; Hydration-safe.
 */

const MAX_LIEFERZEIT_MIN = 45;

interface Props {
  orderedAt: string | null;
  className?: string;
}

function useIsHydrated() {
  const [h, setH] = useState(false);
  useEffect(() => setH(true), []);
  return h;
}

function calcRemaining(orderedAt: string): number {
  const elapsed = (Date.now() - new Date(orderedAt).getTime()) / 60000;
  return Math.max(0, MAX_LIEFERZEIT_MIN - elapsed);
}

export function StorefrontPhase1706LieferzeitGarantieCountdownBadge({ orderedAt, className }: Props) {
  const hydrated = useIsHydrated();
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!orderedAt) return;
    const update = () => setRemaining(calcRemaining(orderedAt));
    update();
    const iv = setInterval(update, 15000); // update every 15s
    return () => clearInterval(iv);
  }, [orderedAt]);

  const display = useMemo(() => {
    if (remaining === null) return null;
    const mins = Math.floor(remaining);
    const secs = Math.floor((remaining - mins) * 60);
    return { mins, secs, expired: remaining <= 0 };
  }, [remaining]);

  if (!hydrated || !orderedAt || display === null) return null;

  const isCritical = !display.expired && display.mins < 10;
  const isExpired = display.expired;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-colors',
        isExpired
          ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 border border-red-300 dark:border-red-700'
          : isCritical
          ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 border border-red-300 dark:border-red-700 animate-pulse'
          : 'bg-matcha-50 text-matcha-700 dark:bg-matcha-950 dark:text-matcha-300 border border-matcha-200 dark:border-matcha-800',
        className,
      )}
    >
      {isCritical || isExpired
        ? <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        : <Clock className="h-3.5 w-3.5 shrink-0" />}

      {isExpired ? (
        <span>Garantiezeit abgelaufen</span>
      ) : (
        <span>
          Garantie: noch{' '}
          <span className="tabular-nums">
            {display.mins}:{String(display.secs).padStart(2, '0')}
          </span>{' '}
          Min
        </span>
      )}
    </div>
  );
}
