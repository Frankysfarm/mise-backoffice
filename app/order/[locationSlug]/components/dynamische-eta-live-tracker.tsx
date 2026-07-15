'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, MapPin, ChefHat, Bike, CheckCircle2, Package } from 'lucide-react';

/**
 * Dynamische ETA Live-Tracker (Storefront)
 *
 * Zeigt dem Kunden die aktuelle Lieferzeit in 4 Phasen:
 * Bestellung eingegangen → Zubereitung → Fahrer unterwegs → Zugestellt
 * Mit Countdown und farbiger Fortschrittsleiste.
 * SSE/Polling-fähig (Props-driven); aktualisiert alle 30s.
 */

type Phase = 'eingegangen' | 'zubereitung' | 'unterwegs' | 'zugestellt';

interface Props {
  phase?: Phase;
  etaMinuten?: number | null;
  bestelltAm?: string | null;
  fahrerName?: string | null;
  className?: string;
}

const PHASEN: { key: Phase; label: string; icon: React.ReactNode; fertigLabel: string }[] = [
  { key: 'eingegangen', label: 'Bestellung eingegangen', icon: <Package className="h-4 w-4" />, fertigLabel: 'Bestätigt' },
  { key: 'zubereitung', label: 'Wird zubereitet', icon: <ChefHat className="h-4 w-4" />, fertigLabel: 'Fertig' },
  { key: 'unterwegs', label: 'Fahrer unterwegs', icon: <Bike className="h-4 w-4" />, fertigLabel: 'Geliefert' },
  { key: 'zugestellt', label: 'Zugestellt', icon: <CheckCircle2 className="h-4 w-4" />, fertigLabel: 'Genießen!' },
];

const PHASE_IDX: Record<Phase, number> = {
  eingegangen: 0, zubereitung: 1, unterwegs: 2, zugestellt: 3,
};

export function DynamischeEtaLiveTracker({ phase = 'zubereitung', etaMinuten, bestelltAm, fahrerName, className }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const currentIdx = PHASE_IDX[phase];
  const vergangenMin = bestelltAm ? Math.floor((now - new Date(bestelltAm).getTime()) / 60_000) : null;
  const verbleibendMin = etaMinuten !== null && etaMinuten !== undefined && vergangenMin !== null
    ? Math.max(0, etaMinuten - vergangenMin)
    : etaMinuten ?? null;
  const fortschrittPct = etaMinuten && vergangenMin !== null
    ? Math.min(100, Math.round((vergangenMin / etaMinuten) * 100))
    : (currentIdx / 3) * 100;

  const ampelFarbe =
    phase === 'zugestellt' ? 'bg-matcha-500' :
    verbleibendMin !== null && verbleibendMin <= 5 ? 'bg-amber-400' :
    'bg-matcha-500';

  return (
    <div className={cn('rounded-2xl border bg-card text-card-foreground shadow-md overflow-hidden', className)}>
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Deine Lieferung
          </span>
          {phase !== 'zugestellt' && verbleibendMin !== null && (
            <span className="flex items-center gap-1 rounded-full bg-matcha-50 dark:bg-matcha-950/40 border border-matcha-200 dark:border-matcha-700 px-3 py-1 text-sm font-black text-matcha-700 dark:text-matcha-300">
              <Clock className="h-3.5 w-3.5" />
              ~{verbleibendMin} Min
            </span>
          )}
          {phase === 'zugestellt' && (
            <span className="flex items-center gap-1 rounded-full bg-matcha-100 dark:bg-matcha-900/40 border border-matcha-200 px-3 py-1 text-sm font-black text-matcha-700 dark:text-matcha-300">
              <CheckCircle2 className="h-3.5 w-3.5" /> Geliefert!
            </span>
          )}
        </div>

        {/* Fortschrittsbalken */}
        <div className="h-2 rounded-full bg-muted overflow-hidden mt-2">
          <div
            className={cn('h-full rounded-full transition-all duration-1000', ampelFarbe)}
            style={{ width: `${fortschrittPct}%` }}
          />
        </div>
      </div>

      {/* Phasen-Timeline */}
      <div className="px-4 pb-4 pt-2">
        <div className="relative flex items-start justify-between">
          {/* Verbindungslinie */}
          <div className="absolute top-3.5 left-3.5 right-3.5 h-0.5 bg-muted" />
          <div
            className={cn('absolute top-3.5 left-3.5 h-0.5 transition-all duration-700', ampelFarbe)}
            style={{ width: `${(currentIdx / (PHASEN.length - 1)) * 100}%` }}
          />

          {PHASEN.map((p, i) => {
            const done = i < currentIdx;
            const aktiv = i === currentIdx;
            const ausstehend = i > currentIdx;
            return (
              <div key={p.key} className="flex flex-col items-center gap-1.5 relative z-10" style={{ flex: '1 1 0', maxWidth: '25%' }}>
                <div className={cn(
                  'h-7 w-7 rounded-full flex items-center justify-center border-2 transition-all',
                  done ? 'bg-matcha-500 border-matcha-500 text-white' :
                  aktiv ? 'bg-white dark:bg-card border-matcha-500 text-matcha-600 dark:text-matcha-400 shadow-md' :
                  'bg-muted border-muted-foreground/30 text-muted-foreground/50',
                )}>
                  {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : p.icon}
                </div>
                <div className={cn(
                  'text-[9px] font-semibold text-center leading-tight',
                  done ? 'text-matcha-600 dark:text-matcha-400' :
                  aktiv ? 'text-foreground font-bold' :
                  'text-muted-foreground',
                )}>
                  {aktiv ? p.label : done ? p.fertigLabel : p.label}
                </div>
              </div>
            );
          })}
        </div>

        {/* Aktiver Status-Text */}
        <div className="mt-4 rounded-xl bg-muted/40 px-3 py-2 flex items-center gap-2">
          <div className={cn('h-2 w-2 rounded-full', phase === 'zugestellt' ? 'bg-matcha-500' : 'bg-matcha-500 animate-pulse')} />
          <div className="flex-1 min-w-0">
            {phase === 'unterwegs' && fahrerName ? (
              <span className="text-xs font-semibold truncate">
                <span className="text-muted-foreground">Dein Fahrer </span>
                <span>{fahrerName}</span>
                <span className="text-muted-foreground"> ist auf dem Weg!</span>
              </span>
            ) : phase === 'unterwegs' ? (
              <span className="text-xs font-semibold text-muted-foreground">Fahrer ist unterwegs zu dir</span>
            ) : phase === 'zubereitung' ? (
              <span className="text-xs font-semibold text-muted-foreground">Dein Essen wird frisch zubereitet</span>
            ) : phase === 'zugestellt' ? (
              <span className="text-xs font-semibold text-matcha-700 dark:text-matcha-300">Guten Appetit! 🎉</span>
            ) : (
              <span className="text-xs font-semibold text-muted-foreground">Bestellung wird bearbeitet</span>
            )}
          </div>
          {verbleibendMin !== null && phase !== 'zugestellt' && (
            <div className="shrink-0 flex items-center gap-1 text-[10px] text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {verbleibendMin === 0 ? 'Gleich da!' : `${verbleibendMin} Min`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
