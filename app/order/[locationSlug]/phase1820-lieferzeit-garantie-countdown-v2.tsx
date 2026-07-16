'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, X, AlertCircle, CheckCircle2, Gift } from 'lucide-react';

/**
 * Phase 1820 — Lieferzeit-Garantie-Countdown-V2 (Storefront)
 *
 * Dynamischer Countdown bis Lieferzusage.
 * Entschädigungs-Hinweis bei Überschreitung.
 * Hydration-safe; schließbar; nach Phase1815.
 */

interface Props {
  locationId: string;
  etaMinuten?: number;
  bestelltAm?: string | null;
  className?: string;
}

type Phase = 'garantie' | 'knapp' | 'ueberschritten';

function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}

function formatCountdown(sekunden: number): string {
  if (sekunden <= 0) return '00:00';
  const m = Math.floor(sekunden / 60);
  const s = sekunden % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const PHASEN_STYLE: Record<Phase, { bg: string; border: string; iconColor: string; textColor: string }> = {
  garantie: {
    bg: 'bg-matcha-50 dark:bg-matcha-950/30',
    border: 'border-matcha-200 dark:border-matcha-800',
    iconColor: 'text-matcha-600 dark:text-matcha-400',
    textColor: 'text-matcha-700 dark:text-matcha-300',
  },
  knapp: {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800',
    iconColor: 'text-amber-600 dark:text-amber-400',
    textColor: 'text-amber-700 dark:text-amber-300',
  },
  ueberschritten: {
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-800',
    iconColor: 'text-red-600 dark:text-red-400',
    textColor: 'text-red-700 dark:text-red-300',
  },
};

export function StorefrontPhase1820LieferzeitGarantieCountdownV2({
  locationId: _locationId,
  etaMinuten = 35,
  bestelltAm,
  className,
}: Props) {
  const hydrated = useHydrated();
  const [geschlossen, setGeschlossen] = useState(false);
  const [verbleibendSek, setVerbleibendSek] = useState<number>(0);

  useEffect(() => {
    if (!hydrated) return;

    const zielMs = bestelltAm
      ? new Date(bestelltAm).getTime() + etaMinuten * 60_000
      : Date.now() + etaMinuten * 60_000;

    const berechne = () => {
      const rest = Math.round((zielMs - Date.now()) / 1000);
      setVerbleibendSek(rest);
    };

    berechne();
    const interval = setInterval(berechne, 1000);
    return () => clearInterval(interval);
  }, [hydrated, bestelltAm, etaMinuten]);

  if (!hydrated || geschlossen) return null;

  const phase: Phase =
    verbleibendSek > 5 * 60 ? 'garantie' :
    verbleibendSek > 0 ? 'knapp' :
    'ueberschritten';

  const style = PHASEN_STYLE[phase];
  const ueberschrittenUm = verbleibendSek < 0 ? Math.abs(Math.floor(verbleibendSek / 60)) : 0;

  return (
    <div className={cn('rounded-2xl border px-4 py-3 mx-4 mt-2', style.bg, style.border, className)}>
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">
          {phase === 'garantie' && <Clock className={cn('h-4 w-4', style.iconColor)} />}
          {phase === 'knapp' && <AlertCircle className={cn('h-4 w-4', style.iconColor)} />}
          {phase === 'ueberschritten' && <Gift className={cn('h-4 w-4', style.iconColor)} />}
        </div>

        <div className="flex-1 min-w-0">
          {phase === 'garantie' && (
            <>
              <div className="flex items-center gap-2">
                <span className={cn('text-xs font-semibold', style.textColor)}>
                  Liefergarantie aktiv
                </span>
                <CheckCircle2 className={cn('h-3.5 w-3.5', style.iconColor)} />
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className={cn('text-2xl font-extrabold tabular-nums', style.textColor)}>
                  {formatCountdown(verbleibendSek)}
                </span>
                <span className="text-[10px] text-muted-foreground">verbleibend bis zur Lieferzusage</span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-matcha-500 transition-all duration-1000"
                  style={{ width: `${Math.max(0, Math.min(100, (verbleibendSek / (etaMinuten * 60)) * 100))}%` }}
                />
              </div>
            </>
          )}

          {phase === 'knapp' && (
            <>
              <div className={cn('text-xs font-semibold', style.textColor)}>
                Fast da — letzte Minuten!
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className={cn('text-2xl font-extrabold tabular-nums animate-pulse', style.textColor)}>
                  {formatCountdown(verbleibendSek)}
                </span>
                <span className="text-[10px] text-muted-foreground">bis Lieferzusage endet</span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-400 transition-all duration-1000"
                  style={{ width: `${Math.max(0, Math.min(100, (verbleibendSek / (5 * 60)) * 100))}%` }}
                />
              </div>
            </>
          )}

          {phase === 'ueberschritten' && (
            <>
              <div className={cn('text-xs font-semibold', style.textColor)}>
                Lieferzusage überschritten — wir entschuldigen uns!
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Deine Bestellung ist <span className={cn('font-semibold', style.textColor)}>{ueberschrittenUm} Min</span> überfällig.
              </div>
              <div className="mt-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 px-2.5 py-1.5">
                <div className="flex items-center gap-1.5">
                  <Gift className="h-3.5 w-3.5 text-red-600 dark:text-red-400 shrink-0" />
                  <span className="text-[11px] font-semibold text-red-700 dark:text-red-300">
                    Als Entschädigung erhältst du einen 10% Rabatt auf deine nächste Bestellung.
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        <button
          onClick={() => setGeschlossen(true)}
          className="shrink-0 p-1 rounded-full hover:bg-muted/50 transition-colors"
          aria-label="Schließen"
        >
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}
