'use client';

import { useMemo, useState } from 'react';
import { Crosshair, ChevronUp, ChevronDown, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Order {
  id: string;
  created_at?: string;
  items?: { name?: string; prep_time_minutes?: number }[];
  actual_prep_minutes?: number;
  ready_at?: string;
}

const ALERT_DRIFT_MIN = 3;

function calcDrift(order: Order): number | null {
  const geplant = order.items?.reduce((s, i) => s + (i.prep_time_minutes ?? 0), 0) ?? 0;
  if (!geplant) return null;
  const actual = order.actual_prep_minutes ?? (() => {
    if (!order.ready_at || !order.created_at) return null;
    return (new Date(order.ready_at).getTime() - new Date(order.created_at).getTime()) / 60000;
  })();
  if (actual === null) return null;
  return Math.round((actual - geplant) * 10) / 10;
}

export function KitchenPhase2006ZubereitungsPraezisionsIndex({
  orders,
}: {
  orders: Order[];
}) {
  const [offen, setOffen] = useState(true);

  const stats = useMemo(() => {
    const drifts: number[] = orders
      .map(calcDrift)
      .filter((d): d is number => d !== null);

    if (!drifts.length) return null;

    const avg = Math.round((drifts.reduce((s, d) => s + d, 0) / drifts.length) * 10) / 10;
    const positiv = drifts.filter((d) => d > 0);
    const negativ = drifts.filter((d) => d <= 0);
    const zuSpaet = positiv.length;
    const fruehzeitig = negativ.length;
    const alert = avg > ALERT_DRIFT_MIN;

    return { avg, zuSpaet, fruehzeitig, gesamt: drifts.length, alert };
  }, [orders]);

  if (!stats) return null;

  const color = stats.avg <= 1
    ? { dot: 'bg-green-500', text: 'text-green-700 dark:text-green-400', bar: 'bg-green-500' }
    : stats.avg <= ALERT_DRIFT_MIN
      ? { dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400', bar: 'bg-amber-500' }
      : { dot: 'bg-red-500', text: 'text-red-700 dark:text-red-400', bar: 'bg-red-500' };

  const maxDrift = 10;
  const barPct = Math.min(100, (Math.abs(stats.avg) / maxDrift) * 100);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
      <button
        onClick={() => setOffen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Crosshair className="w-4 h-4 text-violet-500" />
          <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">Zubereitungs-Präzision</span>
          <div className={cn('w-2 h-2 rounded-full', color.dot)} />
          {stats.alert && (
            <span className="text-[10px] bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-2 py-0.5 rounded-full font-bold">
              Drift &gt;{ALERT_DRIFT_MIN} Min
            </span>
          )}
        </div>
        {offen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {offen && (
        <div className="border-t border-slate-100 dark:border-slate-700">
          {stats.alert && (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-800">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-xs text-red-700 dark:text-red-300 font-medium">
                Ø Drift {stats.avg > 0 ? '+' : ''}{stats.avg} Min — Zubereitungszeit überschreitet Prognose
              </p>
            </div>
          )}

          <div className="px-4 py-3 space-y-3">
            <div className="flex items-center gap-3">
              <span className={cn('text-2xl font-black tabular-nums', color.text)}>
                {stats.avg > 0 ? '+' : ''}{stats.avg} Min
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">Ø Abweichung vs. Prognose</span>
            </div>

            <div>
              <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                <span>Präzision</span>
                <span>{Math.round(100 - barPct)}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-500', color.bar)}
                  style={{ width: `${barPct}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-slate-50 dark:bg-slate-700/50 px-2 py-2">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{stats.gesamt}</p>
                <p className="text-[9px] text-slate-400">Bestellungen</p>
              </div>
              <div className="rounded-lg bg-green-50 dark:bg-green-900/20 px-2 py-2">
                <p className="text-xs font-bold text-green-700 dark:text-green-400">{stats.fruehzeitig}</p>
                <p className="text-[9px] text-slate-400">Früh/Pünktlich</p>
              </div>
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-2 py-2">
                <p className="text-xs font-bold text-red-700 dark:text-red-400">{stats.zuSpaet}</p>
                <p className="text-[9px] text-slate-400">Zu spät</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
