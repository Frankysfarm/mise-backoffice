'use client';

/**
 * Phase 552 — Schicht-Tempo-Ampel
 *
 * Zeigt dem Fahrer in Echtzeit, ob er auf Kurs ist sein Schicht-Ziel zu erreichen:
 * - Aktuelle Pace (Stops/h) vs. benötigte Pace
 * - Hochgerechnete Schicht-Einnahmen
 * - Farbkodierte Ampel: grün (auf Kurs), amber (leicht hinter), rot (deutlich hinter)
 * - Empfehlung: "Weiter so!" / "1 Stop mehr pro Stunde nötig"
 */

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { euro } from '@/lib/utils';
import { Gauge, TrendingUp, TrendingDown, Minus, Target, Zap } from 'lucide-react';

interface Stop {
  id: string;
  geliefert_am: string | null;
  angekommen_am: string | null;
}

interface Props {
  activeBatch: {
    id: string;
    started_at: string | null;
    stops: Stop[];
  } | null;
  schichtStart: string | null;
  earningsTarget?: number;
  earningsPerStop?: number;
}

type Ampel = 'gruen' | 'amber' | 'rot';

const AMPEL: Record<Ampel, { bg: string; border: string; label: string; textColor: string }> = {
  gruen: { bg: 'bg-matcha-50',  border: 'border-matcha-300', label: 'Auf Kurs',       textColor: 'text-matcha-700' },
  amber: { bg: 'bg-amber-50',   border: 'border-amber-300',  label: 'Leicht zurück',  textColor: 'text-amber-700'  },
  rot:   { bg: 'bg-red-50',     border: 'border-red-300',    label: 'Deutlich zurück',textColor: 'text-red-700'    },
};

export function FahrerPhase552SchichtTempoAmpel({
  activeBatch,
  schichtStart,
  earningsTarget = 80,
  earningsPerStop = 4.5,
}: Props) {
  const [nowMs, setNowMs] = useState(Date.now);

  useEffect(() => {
    const iv = setInterval(() => setNowMs(Date.now()), 10_000);
    return () => clearInterval(iv);
  }, []);

  const stats = useMemo(() => {
    const startMs = schichtStart ? new Date(schichtStart).getTime() : nowMs - 3_600_000;
    const elapsedH = Math.max((nowMs - startMs) / 3_600_000, 0.1);

    const completedStops = activeBatch?.stops.filter(s => s.geliefert_am != null).length ?? 0;
    const currentPace = completedStops / elapsedH;
    const requiredPace = earningsTarget / earningsPerStop / Math.max(4, elapsedH);
    const projectedStops = currentPace * 8;
    const projectedEarnings = projectedStops * earningsPerStop;

    let ampel: Ampel = 'gruen';
    const ratio = currentPace / Math.max(requiredPace, 0.1);
    if (ratio < 0.7) ampel = 'rot';
    else if (ratio < 0.9) ampel = 'amber';

    const delta = currentPace - requiredPace;
    return { elapsedH, completedStops, currentPace, requiredPace, projectedEarnings, ampel, delta };
  }, [nowMs, schichtStart, activeBatch, earningsTarget, earningsPerStop]);

  const style = AMPEL[stats.ampel];
  const TrendIcon = stats.delta > 0.2 ? TrendingUp : stats.delta < -0.2 ? TrendingDown : Minus;

  return (
    <div className={cn('rounded-xl border p-4 space-y-3', style.bg, style.border)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Gauge className={cn('h-4 w-4', style.textColor)} />
          <span className={cn('text-[11px] font-bold uppercase tracking-wider', style.textColor)}>
            Schicht-Tempo
          </span>
        </div>
        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-black', style.bg, style.border, 'border', style.textColor)}>
          {style.label}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="text-center">
          <div className={cn('text-2xl font-black tabular-nums', style.textColor)}>
            {stats.completedStops}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Stops heute</div>
        </div>
        <div className="text-center border-x border-border/50">
          <div className="flex items-center justify-center gap-0.5">
            <span className={cn('text-2xl font-black tabular-nums', style.textColor)}>
              {stats.currentPace.toFixed(1)}
            </span>
            <TrendIcon className={cn('h-4 w-4 mt-1', style.textColor)} />
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Stops/h aktuell</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-black tabular-nums text-foreground">
            {stats.requiredPace.toFixed(1)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Stops/h Ziel</div>
        </div>
      </div>

      <div className="rounded-lg bg-background/60 border border-border/50 flex items-center gap-3 px-3 py-2">
        <Target className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-muted-foreground">Hochrechnung Schicht (8h)</div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-sm font-bold">{euro(stats.projectedEarnings)}</span>
            <span className="text-[10px] text-muted-foreground">von Ziel {euro(earningsTarget)}</span>
          </div>
        </div>
        <Zap className={cn('h-4 w-4 shrink-0', stats.ampel === 'gruen' ? 'text-matcha-500' : stats.ampel === 'amber' ? 'text-amber-500' : 'text-red-500')} />
      </div>

      {stats.ampel !== 'gruen' && (
        <p className={cn('text-[11px] font-medium', style.textColor)}>
          {stats.ampel === 'amber'
            ? `+${(stats.requiredPace - stats.currentPace).toFixed(1)} Stops/h mehr nötig — du schaffst das!`
            : `Pace deutlich erhöhen: ${(stats.requiredPace - stats.currentPace).toFixed(1)} Stops/h fehlen.`}
        </p>
      )}
    </div>
  );
}
