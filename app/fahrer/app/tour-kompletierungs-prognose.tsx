'use client';

/**
 * TourKompletierungsPrognose — Phase 440
 * Zeigt dem Fahrer eine präzise Prognose wann alle verbleibenden Tour-Stopps
 * abgeschlossen sein werden — basierend auf Ø-Zeit pro Stopp aus bisherigen Stopps.
 * Farbkodierung: Grün = plan, Gelb = leicht spät, Rot = kritisch spät.
 */

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Clock, Target, CheckCircle2, TrendingUp } from 'lucide-react';

interface Stop {
  id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  eta_min?: number | null;
  order: {
    id: string;
    bestellnummer: string;
    kunde_name: string;
  } | null;
}

interface Props {
  stops: Stop[];
  tourStart: string | null;
  className?: string;
}

function formatTime(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function fmtMin(min: number): string {
  if (min < 60) return `${Math.round(min)} Min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}h ${m}m`;
}

export function TourKompletierungsPrognose({ stops, tourStart, className }: Props) {
  const now = Date.now();

  const analysis = useMemo(() => {
    const sorted = [...stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
    const done = sorted.filter(s => s.geliefert_am);
    const remaining = sorted.filter(s => !s.geliefert_am);

    if (remaining.length === 0) return null;

    // Berechne Ø-Zeit pro Stopp aus abgeschlossenen Stopps
    let avgMinPerStop = 8;
    if (done.length >= 2 && tourStart) {
      const startMs = new Date(tourStart).getTime();
      const lastDone = done[done.length - 1];
      const elapsedMin = (new Date(lastDone.geliefert_am!).getTime() - startMs) / 60_000;
      avgMinPerStop = Math.max(4, elapsedMin / done.length);
    }

    // ETA-basierte Prognose
    const remainingEtaMin = remaining.reduce((sum, s) => sum + (s.eta_min ?? avgMinPerStop), 0);
    const etaMs = now + remainingEtaMin * 60_000;
    const elapsedFromStartMin = tourStart
      ? (now - new Date(tourStart).getTime()) / 60_000
      : 0;

    const stopsPerHour = avgMinPerStop > 0 ? 60 / avgMinPerStop : 7.5;
    const onTimePct = done.length / (done.length + remaining.length);

    let status: 'good' | 'tight' | 'late' = 'good';
    if (remainingEtaMin > 60) status = 'late';
    else if (remainingEtaMin > 35) status = 'tight';

    return {
      sorted,
      done,
      remaining,
      avgMinPerStop,
      remainingEtaMin,
      etaMs,
      elapsedFromStartMin,
      stopsPerHour,
      onTimePct,
      status,
      nextStop: remaining[0],
    };
  }, [stops, tourStart, now]);

  if (!analysis) {
    return (
      <div className={cn('rounded-xl border bg-matcha-50 border-matcha-200 px-4 py-3 flex items-center gap-2', className)}>
        <CheckCircle2 className="h-5 w-5 text-matcha-600" />
        <div>
          <div className="text-sm font-bold text-matcha-800">Tour abgeschlossen!</div>
          <div className="text-[11px] text-matcha-600">Alle {stops.length} Stopps erledigt</div>
        </div>
      </div>
    );
  }

  const { done, remaining, avgMinPerStop, remainingEtaMin, etaMs, stopsPerHour, onTimePct, status, nextStop } = analysis;

  const statusStyle = {
    good:  { bg: 'bg-matcha-50',  border: 'border-matcha-200', text: 'text-matcha-800',  etaColor: 'text-matcha-700', barColor: 'bg-matcha-500' },
    tight: { bg: 'bg-amber-50',   border: 'border-amber-200',  text: 'text-amber-800',   etaColor: 'text-amber-700',  barColor: 'bg-amber-400' },
    late:  { bg: 'bg-red-50',     border: 'border-red-200',    text: 'text-red-800',     etaColor: 'text-red-700',    barColor: 'bg-red-500' },
  }[status];

  const progressPct = done.length / (done.length + remaining.length) * 100;

  return (
    <div className={cn('rounded-xl border overflow-hidden', statusStyle.bg, statusStyle.border, className)}>
      {/* Header */}
      <div className="px-4 pt-3 pb-2 flex items-center gap-2">
        <Target className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tour-Abschluss-Prognose</span>
      </div>

      {/* Main ETA */}
      <div className="px-4 pb-3 flex items-end gap-3">
        <div>
          <div className={cn('text-3xl font-black tabular-nums leading-none', statusStyle.etaColor)}>
            {formatTime(etaMs)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            in ~{fmtMin(remainingEtaMin)} · {remaining.length} Stopp{remaining.length !== 1 ? 's' : ''} offen
          </div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-[10px] text-muted-foreground">Ø je Stopp</div>
          <div className="text-base font-black tabular-nums">{Math.round(avgMinPerStop)} Min</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="flex-1 h-2 rounded-full bg-black/10 overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-700', statusStyle.barColor)}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-[10px] font-bold tabular-nums text-muted-foreground shrink-0">
            {done.length}/{done.length + remaining.length}
          </span>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-3 divide-x border-t">
        <div className="px-3 py-2 text-center">
          <div className="text-base font-black tabular-nums">{stopsPerHour.toFixed(1)}</div>
          <div className="text-[8px] text-muted-foreground uppercase tracking-wide">Stopp/h</div>
        </div>
        <div className="px-3 py-2 text-center">
          <div className={cn('text-base font-black tabular-nums', onTimePct >= 0.8 ? 'text-matcha-700' : onTimePct >= 0.6 ? 'text-amber-700' : 'text-red-600')}>
            {Math.round(onTimePct * 100)}%
          </div>
          <div className="text-[8px] text-muted-foreground uppercase tracking-wide">Erledigt</div>
        </div>
        <div className="px-3 py-2 text-center">
          <div className="text-base font-black tabular-nums text-foreground">
            {remaining.length}
          </div>
          <div className="text-[8px] text-muted-foreground uppercase tracking-wide">Offen</div>
        </div>
      </div>

      {/* Next stop */}
      {nextStop?.order && (
        <div className="px-4 py-2.5 border-t bg-white/40 flex items-center gap-2">
          <TrendingUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <div className="text-[11px] min-w-0">
            <span className="font-semibold text-muted-foreground">Nächster: </span>
            <span className="font-bold truncate">{nextStop.order.kunde_name}</span>
          </div>
          {nextStop.eta_min != null && (
            <span className="ml-auto text-[10px] font-bold text-muted-foreground shrink-0">
              ~{nextStop.eta_min} Min
            </span>
          )}
        </div>
      )}
    </div>
  );
}
