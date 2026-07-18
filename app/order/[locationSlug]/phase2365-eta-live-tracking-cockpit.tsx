'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bike, Clock, CheckCircle2, ChefHat, MapPin, Zap, Package } from 'lucide-react';

/**
 * Phase 2365 — ETA Live-Tracking Cockpit (Storefront)
 *
 * Dynamisches ETA-Widget für Kunden: Zeigt Bestellstatus, verbleibende Zeit
 * und Fahrer-Annäherung mit farbkodierter Ampel an.
 */

type DeliveryPhase = 'bestaetigt' | 'zubereitung' | 'abholung' | 'unterwegs' | 'angekommen' | 'geliefert';

interface Props {
  orderId?: string | null;
  phase?: DeliveryPhase;
  etaMin?: number | null;
  fahrerName?: string | null;
  distanzM?: number | null;
  elapsedMin?: number | null;
}

const PHASE_CONFIG: Record<DeliveryPhase, { icon: React.ComponentType<{ className?: string }>; label: string; sub: string; color: string; step: number }> = {
  bestaetigt: { icon: Package,       label: 'Bestellung bestätigt',    sub: 'Küche bereitet vor',          color: 'text-blue-600',    step: 1 },
  zubereitung: { icon: ChefHat,      label: 'Wird zubereitet',         sub: 'Küche kocht gerade',          color: 'text-amber-600',   step: 2 },
  abholung:    { icon: Bike,         label: 'Fahrer holt ab',          sub: 'Unterwegs zu dir',            color: 'text-matcha-600',  step: 3 },
  unterwegs:   { icon: Bike,         label: 'Fahrer unterwegs',        sub: 'Kommt bald an',               color: 'text-matcha-600',  step: 4 },
  angekommen:  { icon: MapPin,       label: 'Fahrer ist da!',          sub: 'Öffne bitte die Tür',         color: 'text-matcha-700',  step: 5 },
  geliefert:   { icon: CheckCircle2, label: 'Geliefert! 🎉',           sub: 'Guten Appetit!',              color: 'text-matcha-700',  step: 6 },
};

const PHASES: DeliveryPhase[] = ['bestaetigt', 'zubereitung', 'abholung', 'unterwegs', 'angekommen', 'geliefert'];

function etaColor(min: number | null | undefined): string {
  if (min === null || min === undefined) return 'text-muted-foreground';
  if (min <= 5)  return 'text-matcha-600 dark:text-matcha-400';
  if (min <= 15) return 'text-amber-600 dark:text-amber-400';
  return 'text-foreground';
}

function etaBadgeBg(min: number | null | undefined): string {
  if (min === null || min === undefined) return 'bg-muted/50 border-border';
  if (min <= 5)  return 'bg-matcha-100 dark:bg-matcha-900/30 border-matcha-300';
  if (min <= 15) return 'bg-amber-100 dark:bg-amber-900/30 border-amber-300';
  return 'bg-muted/50 border-border';
}

export function StorefrontPhase2365EtaLiveTrackingCockpit({
  orderId,
  phase = 'zubereitung',
  etaMin = 22,
  fahrerName,
  distanzM,
  elapsedMin,
}: Props) {
  const [tick, setTick] = useState(0);
  const [currentEta, setCurrentEta] = useState(etaMin ?? 22);

  useEffect(() => {
    const id = setInterval(() => {
      setTick(t => t + 1);
      setCurrentEta(e => Math.max(0, e - (1 / 60))); // decrease per second
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const cfg = PHASE_CONFIG[phase];
  const Icon = cfg.icon;
  const currentStep = cfg.step;
  const etaRound = Math.ceil(currentEta);
  const isDone = phase === 'geliefert';

  const progressPct = useMemo(() => {
    if (isDone) return 100;
    return ((currentStep - 1) / (PHASES.length - 1)) * 100;
  }, [currentStep, isDone]);

  return (
    <div className="rounded-2xl border bg-card text-card-foreground shadow-sm overflow-hidden">
      {/* Header */}
      <div className={cn('px-4 pt-4 pb-3 flex items-center gap-3', isDone && 'bg-matcha-50 dark:bg-matcha-950/20')}>
        <div className={cn(
          'shrink-0 h-10 w-10 rounded-full flex items-center justify-center',
          isDone ? 'bg-matcha-100 dark:bg-matcha-900/40' : 'bg-muted',
        )}>
          <Icon className={cn('h-5 w-5', cfg.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold leading-tight">{cfg.label}</p>
          <p className="text-[11px] text-muted-foreground">{cfg.sub}</p>
        </div>
        {!isDone && (
          <div className={cn('shrink-0 rounded-xl border px-3 py-1.5 text-center', etaBadgeBg(etaRound))}>
            <div className={cn('text-lg font-black leading-none tabular-nums', etaColor(etaRound))}>
              {etaRound}
            </div>
            <div className="text-[9px] text-muted-foreground font-medium">Min</div>
          </div>
        )}
      </div>

      {/* Step progress */}
      <div className="px-4 pb-3">
        {/* Line */}
        <div className="relative h-1.5 rounded-full bg-muted overflow-hidden mb-3">
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-matcha-500 transition-all duration-700"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Step dots */}
        <div className="flex items-center justify-between">
          {PHASES.map((p, i) => {
            const stepNum = i + 1;
            const done = stepNum < currentStep;
            const active = stepNum === currentStep;
            return (
              <div key={p} className="flex flex-col items-center gap-1">
                <div className={cn(
                  'h-3 w-3 rounded-full border-2 transition-all',
                  done   ? 'bg-matcha-500 border-matcha-500' :
                  active ? 'bg-blue-500 border-blue-500 scale-125' :
                           'bg-background border-muted-foreground/30',
                )} />
                <span className={cn(
                  'text-[8px] font-medium leading-none hidden sm:block',
                  active ? 'text-foreground font-bold' : 'text-muted-foreground',
                )}>
                  {PHASE_CONFIG[p].icon.displayName?.slice(0, 5) ?? ''}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fahrer info */}
      {(fahrerName || distanzM !== undefined) && (
        <div className="border-t px-4 py-2.5 flex items-center gap-3 bg-muted/20">
          <Bike className="h-3.5 w-3.5 text-matcha-600 shrink-0" />
          {fahrerName && <span className="text-xs font-bold">{fahrerName}</span>}
          {distanzM !== undefined && distanzM !== null && (
            <span className="text-[10px] text-muted-foreground">
              {distanzM >= 1000 ? `${(distanzM / 1000).toFixed(1)} km` : `${distanzM} m`} entfernt
            </span>
          )}
          <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
            <Zap className="h-3 w-3 text-matcha-500" /> Live
          </span>
        </div>
      )}

      {/* Done state */}
      {isDone && (
        <div className="border-t px-4 py-3 bg-matcha-50 dark:bg-matcha-950/20 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-matcha-600" />
          <span className="text-xs font-bold text-matcha-700 dark:text-matcha-300">Deine Bestellung wurde geliefert!</span>
        </div>
      )}
    </div>
  );
}
