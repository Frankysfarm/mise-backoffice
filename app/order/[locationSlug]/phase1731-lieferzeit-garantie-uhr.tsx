'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Timer, X, Gift } from 'lucide-react';

/**
 * Phase 1731 — Lieferzeit-Garantie-Uhr (Storefront)
 *
 * Countdown bis ETA; wenn ETA überschritten: Entschädigungs-Hinweis.
 * Props orderPlaced (ISO-Timestamp) + etaMinuten; schließbar; Hydration-safe.
 */

interface Props {
  orderPlaced: string | null;
  etaMinuten?: number;
  className?: string;
}

export function StorefrontPhase1731LieferzeitGarantieUhr({
  orderPlaced,
  etaMinuten = 45,
  className,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [tick, setTick] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setMounted(true);
    intervalRef.current = setInterval(() => setTick(t => t + 1), 1_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  if (!mounted || !orderPlaced || dismissed) return null;

  const placedMs = new Date(orderPlaced).getTime();
  if (isNaN(placedMs)) return null;

  const etaMs = placedMs + etaMinuten * 60_000;
  const nowMs = Date.now();
  const remainMs = etaMs - nowMs;
  const ueberschritten = remainMs <= 0;

  const absSec = Math.abs(Math.floor(remainMs / 1_000));
  const min = Math.floor(absSec / 60);
  const sec = absSec % 60;
  const display = `${min}:${sec.toString().padStart(2, '0')}`;

  const warningBald = !ueberschritten && remainMs < 5 * 60_000;

  return (
    <div className={cn(
      'rounded-xl border p-3 transition-all',
      ueberschritten
        ? 'border-red-300 dark:border-red-700 bg-red-50/40 dark:bg-red-950/10'
        : warningBald
        ? 'border-amber-300 dark:border-amber-700 bg-amber-50/30 dark:bg-amber-950/10'
        : 'border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-950/10',
      className,
    )}>
      <div className="flex items-start gap-3">
        <Timer className={cn(
          'h-5 w-5 mt-0.5 shrink-0',
          ueberschritten ? 'text-red-500' : warningBald ? 'text-amber-500' : 'text-green-500',
        )} />

        <div className="flex-1 min-w-0">
          {ueberschritten ? (
            <>
              <p className="text-sm font-bold text-red-700 dark:text-red-300 flex items-center gap-1.5">
                <span className="tabular-nums font-mono">+{display}</span>
                <span>überschritten</span>
              </p>
              <div className="mt-1.5 flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-700 bg-red-100/60 dark:bg-red-900/30 px-2.5 py-2">
                <Gift className="h-3.5 w-3.5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                <p className="text-[11px] text-red-700 dark:text-red-300 font-medium">
                  Deine Bestellung hat sich leider verzögert. Wir entschuldigen uns — wende dich an unser Team für eine Entschädigung.
                </p>
              </div>
            </>
          ) : (
            <>
              <p className={cn(
                'text-sm font-bold',
                warningBald ? 'text-amber-700 dark:text-amber-300' : 'text-green-700 dark:text-green-300',
              )}>
                Lieferung in{' '}
                <span className={cn(
                  'tabular-nums font-mono',
                  warningBald && 'animate-pulse',
                )}>
                  {display}
                </span>
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {etaMinuten}-Minuten-Garantie · Bestellung um {new Date(orderPlaced).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
              </p>
            </>
          )}
        </div>

        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Schließen"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
