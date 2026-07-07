'use client';

/**
 * Phase 575 — Fahrer-App: Schicht-Effizienz-Cockpit
 *
 * Kompakte Live-Ansicht der eigenen Schicht-Performance:
 * - Bestellungen/Stunde (aktuell vs. Ziel)
 * - Ø Zeit pro Stopp
 * - Pünktlichkeits-Rate
 * - Ziel-Vergleich (grün/amber/rot)
 *
 * Mobile-first, Matcha-Theme, 60s Auto-Refresh
 */

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, ChevronDown, ChevronUp, Clock, Target, TrendingUp, Zap } from 'lucide-react';

interface Stop {
  id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  angekommen_am?: string | null;
  eta_latest?: string | null;
  order?: { eta_latest?: string | null; eta_earliest?: string | null } | null;
}

interface CompletedTour {
  id: string;
  started_at?: string | null;
  ended_at?: string | null;
  stops: Stop[];
}

interface Props {
  completedTours?: CompletedTour[];
  currentShiftStart?: string | null;
  totalDelivered?: number;
  targetPerHour?: number;
}

const TARGET_PER_HOUR = 4;
const TARGET_ON_TIME_PCT = 85;

export function FahrerPhase575SchichtEffizienzCockpit({
  completedTours = [],
  currentShiftStart = null,
  totalDelivered = 0,
  targetPerHour = TARGET_PER_HOUR,
}: Props) {
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const stats = useMemo(() => {
    const now = Date.now();
    const shiftStart = currentShiftStart ? new Date(currentShiftStart).getTime() : now - 3_600_000;
    const shiftDurationH = Math.max(0.1, (now - shiftStart) / 3_600_000);

    // Deliveries per hour
    const deliveriesPerH = totalDelivered > 0 ? totalDelivered / shiftDurationH : 0;

    // Avg time per stop from completed tours
    const allStops = completedTours.flatMap(t => t.stops);
    const deliveredStops = allStops.filter(s => s.geliefert_am && s.angekommen_am);
    let avgStopMin = 0;
    if (deliveredStops.length > 0) {
      const totalMin = deliveredStops.reduce((sum, s) => {
        const arrived = new Date(s.angekommen_am!).getTime();
        const delivered = new Date(s.geliefert_am!).getTime();
        return sum + (delivered - arrived) / 60_000;
      }, 0);
      avgStopMin = totalMin / deliveredStops.length;
    }

    // On-time rate
    const stopsWithEta = allStops.filter(s => s.geliefert_am && (s.order?.eta_latest ?? s.eta_latest));
    let onTimePct = 100;
    if (stopsWithEta.length > 0) {
      const onTime = stopsWithEta.filter(s => {
        const delivered = new Date(s.geliefert_am!).getTime();
        const eta = new Date((s.order?.eta_latest ?? s.eta_latest)!).getTime();
        return delivered <= eta;
      }).length;
      onTimePct = Math.round((onTime / stopsWithEta.length) * 100);
    }

    const rateGood = deliveriesPerH >= targetPerHour * 0.9;
    const stopGood = avgStopMin === 0 || avgStopMin <= 6;
    const onTimeGood = onTimePct >= TARGET_ON_TIME_PCT;

    const overallScore = [rateGood, stopGood, onTimeGood].filter(Boolean).length;

    return { deliveriesPerH, avgStopMin, onTimePct, rateGood, stopGood, onTimeGood, overallScore, shiftDurationH };
  }, [completedTours, currentShiftStart, totalDelivered, targetPerHour, tick]);

  const scoreColor = stats.overallScore === 3 ? 'text-emerald-600' : stats.overallScore === 2 ? 'text-amber-600' : 'text-red-600';
  const scoreBg = stats.overallScore === 3 ? 'bg-emerald-50 border-emerald-200' : stats.overallScore === 2 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';

  return (
    <div className="rounded-xl border border-matcha-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-matcha-50 transition"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold text-matcha-800">Schicht-Effizienz</span>
          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold border', scoreBg, scoreColor)}>
            {stats.overallScore}/3 Ziele
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-matcha-500" /> : <ChevronDown className="h-4 w-4 text-matcha-500" />}
      </button>

      {open && (
        <div className="border-t border-matcha-100 px-4 py-3 space-y-3">
          {/* KPI tiles */}
          <div className="grid grid-cols-3 gap-2">
            {/* Deliveries/h */}
            <div className={cn('rounded-xl border p-2.5 text-center', stats.rateGood ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200')}>
              <div className={cn('text-xl font-black tabular-nums', stats.rateGood ? 'text-emerald-700' : 'text-amber-700')}>
                {stats.deliveriesPerH.toFixed(1)}
              </div>
              <div className="text-[9px] text-muted-foreground font-medium mt-0.5">Liefg/h</div>
              <div className="text-[9px] text-muted-foreground">Ziel: {targetPerHour}/h</div>
            </div>

            {/* Avg stop time */}
            <div className={cn('rounded-xl border p-2.5 text-center', stats.stopGood ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200')}>
              <div className={cn('text-xl font-black tabular-nums', stats.stopGood ? 'text-emerald-700' : 'text-amber-700')}>
                {stats.avgStopMin > 0 ? `${stats.avgStopMin.toFixed(0)}m` : '—'}
              </div>
              <div className="text-[9px] text-muted-foreground font-medium mt-0.5">Ø/Stopp</div>
              <div className="text-[9px] text-muted-foreground">Ziel: ≤6 Min</div>
            </div>

            {/* On-time rate */}
            <div className={cn('rounded-xl border p-2.5 text-center', stats.onTimeGood ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200')}>
              <div className={cn('text-xl font-black tabular-nums', stats.onTimeGood ? 'text-emerald-700' : 'text-red-600')}>
                {stats.onTimePct}%
              </div>
              <div className="text-[9px] text-muted-foreground font-medium mt-0.5">Pünktlich</div>
              <div className="text-[9px] text-muted-foreground">Ziel: {TARGET_ON_TIME_PCT}%</div>
            </div>
          </div>

          {/* Goal checklist */}
          <div className="space-y-1.5">
            {[
              { ok: stats.rateGood, label: `Lieferrate: ${stats.deliveriesPerH.toFixed(1)}/h (Ziel: ${targetPerHour})` },
              { ok: stats.stopGood, label: `Stopp-Zeit: ${stats.avgStopMin > 0 ? `${stats.avgStopMin.toFixed(0)} Min` : 'kein Daten'} (Ziel: ≤6 Min)` },
              { ok: stats.onTimeGood, label: `Pünktlichkeit: ${stats.onTimePct}% (Ziel: ${TARGET_ON_TIME_PCT}%)` },
            ].map((g, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <CheckCircle2 className={cn('h-3.5 w-3.5 shrink-0', g.ok ? 'text-emerald-500' : 'text-slate-300')} />
                <span className={g.ok ? 'text-slate-700' : 'text-slate-400'}>{g.label}</span>
              </div>
            ))}
          </div>

          {/* Shift duration */}
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground pt-1 border-t border-matcha-100">
            <Clock className="h-3 w-3" />
            <span>Schichtdauer: {stats.shiftDurationH.toFixed(1)} h · {totalDelivered} Lieferungen gesamt</span>
          </div>
        </div>
      )}
    </div>
  );
}
