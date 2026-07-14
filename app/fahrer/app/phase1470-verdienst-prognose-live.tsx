'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Euro, TrendingUp, TrendingDown, Minus } from 'lucide-react';

// Phase 1470 — Verdienst-Prognose-Live (Fahrer-App)
// Live-Hochrechnung Tagesverdienst auf Basis bisheriger Stopps + Schichtdauer;
// Props-basiert; keine API; nach Phase1469.

interface Props {
  driverId: string;
  isOnline: boolean;
  completedStops: number;
  totalStops: number;
  schichtStartISO: string | null;
  earningsToday: number;
  earningsGoal?: number;
}

function fmtEur(n: number): string {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function FahrerPhase1470VerdienstPrognoseLive({
  isOnline,
  completedStops,
  totalStops,
  schichtStartISO,
  earningsToday,
  earningsGoal = 60,
}: Props) {
  const prognose = useMemo(() => {
    if (completedStops <= 0) return earningsToday;
    const perStop = earningsToday / completedStops;
    return perStop * Math.max(totalStops, completedStops);
  }, [earningsToday, completedStops, totalStops]);

  const schichtMinuten = useMemo(() => {
    if (!schichtStartISO) return 0;
    return Math.max(0, Math.round((Date.now() - new Date(schichtStartISO).getTime()) / 60_000));
  }, [schichtStartISO]);

  const schichtStd = (schichtMinuten / 60).toFixed(1);
  const pctZiel = Math.min(100, Math.round((earningsToday / earningsGoal) * 100));
  const prognoseZiel = Math.min(100, Math.round((prognose / earningsGoal) * 100));

  const trend: 'besser' | 'gleich' | 'schlechter' =
    prognose >= earningsGoal ? 'besser' : prognose >= earningsGoal * 0.85 ? 'gleich' : 'schlechter';

  const TREND_CFG = {
    besser:     { Icon: TrendingUp,   cls: 'text-emerald-600 dark:text-emerald-400', label: 'Ziel erreichbar' },
    gleich:     { Icon: Minus,        cls: 'text-amber-500 dark:text-amber-400',     label: 'Knapp' },
    schlechter: { Icon: TrendingDown, cls: 'text-rose-600 dark:text-rose-400',       label: 'Unter Ziel' },
  };
  const cfg = TREND_CFG[trend];
  const { Icon } = cfg;

  if (!isOnline) return null;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b">
        <Euro className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Verdienst-Prognose</span>
        <span className={cn('ml-auto flex items-center gap-1 text-[10px] font-bold', cfg.cls)}>
          <Icon className="h-3.5 w-3.5" />
          {cfg.label}
        </span>
      </div>
      <div className="px-4 py-4 space-y-3">
        {/* Today actual */}
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Bisher heute</div>
            <div className="text-2xl font-black tabular-nums">{fmtEur(earningsToday)} €</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Prognose</div>
            <div className={cn('text-lg font-black tabular-nums', cfg.cls)}>{fmtEur(prognose)} €</div>
          </div>
        </div>
        {/* Progress */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Ziel: {fmtEur(earningsGoal)} €</span>
            <span>{pctZiel}% erreicht</span>
          </div>
          <div className="relative h-3 rounded-full bg-muted overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-muted-foreground/30 transition-all duration-700"
              style={{ width: `${prognoseZiel}%` }}
            />
            <div
              className={cn('absolute inset-y-0 left-0 rounded-full transition-all duration-700',
                trend === 'besser' ? 'bg-emerald-500' : trend === 'gleich' ? 'bg-amber-400' : 'bg-rose-500'
              )}
              style={{ width: `${pctZiel}%` }}
            />
          </div>
        </div>
        {/* Meta */}
        <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
          <span>{completedStops} Stopps abgeschlossen</span>
          <span>·</span>
          <span>{schichtStd}h Schicht</span>
        </div>
      </div>
    </div>
  );
}
