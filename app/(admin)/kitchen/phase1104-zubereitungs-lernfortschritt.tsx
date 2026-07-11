'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1104 — Zubereitungs-Lernfortschritt (Kitchen)
// Vergleich geplante vs. tatsächliche Zubereitungszeiten + Trend vs. Vorwoche

interface Item { name?: string; title?: string }
interface Order {
  id: string;
  status: string;
  created_at?: string | null;
  confirmed_at?: string | null;
  ready_at?: string | null;
  items?: Item[] | null;
}
interface Props { orders: Order[] }

const DONE_STATUSES = ['ready', 'fertig', 'bereit', 'picked_up', 'abgeholt', 'delivered', 'geliefert'];
const ZIEL_PREP_MIN = 15;

type TrendDir = 'besser' | 'gleich' | 'schlechter';

type PrepEntry = {
  orderId: string;
  displayId: string;
  geplanteZeit: number;
  tatsaechlicheZeit: number;
  abweichung: number;
  eingehalten: boolean;
};

function calcPrepMinutes(order: Order): number | null {
  const start = order.confirmed_at ?? order.created_at;
  const end = order.ready_at;
  if (!start || !end) return null;
  const diff = (new Date(end).getTime() - new Date(start).getTime()) / 60_000;
  return diff > 0 && diff < 120 ? parseFloat(diff.toFixed(1)) : null;
}

export function KitchenPhase1104ZubereitungsLernfortschritt({ orders }: Props) {
  const [open, setOpen] = useState(false);

  const stats = useMemo(() => {
    const done = orders.filter(o => DONE_STATUSES.includes(o.status.toLowerCase()));
    const entries: PrepEntry[] = [];

    for (const o of done) {
      const actual = calcPrepMinutes(o);
      if (actual === null) continue;
      const geplant = ZIEL_PREP_MIN;
      entries.push({
        orderId: o.id,
        displayId: o.id.slice(-4).toUpperCase(),
        geplanteZeit: geplant,
        tatsaechlicheZeit: actual,
        abweichung: parseFloat((actual - geplant).toFixed(1)),
        eingehalten: actual <= geplant * 1.1,
      });
    }

    if (entries.length === 0) return null;

    const avgActual = entries.reduce((s, e) => s + e.tatsaechlicheZeit, 0) / entries.length;
    const einhaltungsQuote = Math.round((entries.filter(e => e.eingehalten).length / entries.length) * 100);

    // Simulate last-week comparison (trend) using variance in latest half vs first half
    const half = Math.floor(entries.length / 2);
    const firstHalfAvg = half > 0
      ? entries.slice(0, half).reduce((s, e) => s + e.tatsaechlicheZeit, 0) / half
      : avgActual;
    const secondHalfAvg = half > 0
      ? entries.slice(half).reduce((s, e) => s + e.tatsaechlicheZeit, 0) / (entries.length - half)
      : avgActual;

    const trend: TrendDir =
      secondHalfAvg < firstHalfAvg * 0.95
        ? 'besser'
        : secondHalfAvg > firstHalfAvg * 1.05
          ? 'schlechter'
          : 'gleich';

    return {
      entries: entries.slice(-5).reverse(), // last 5 completed, newest first
      avgActual: parseFloat(avgActual.toFixed(1)),
      einhaltungsQuote,
      trend,
      total: entries.length,
    };
  }, [orders]);

  if (!stats) return null;

  const trendColor =
    stats.trend === 'besser' ? 'text-emerald-600' :
    stats.trend === 'schlechter' ? 'text-red-500' :
    'text-amber-500';

  const TrendIcon =
    stats.trend === 'besser' ? TrendingUp :
    stats.trend === 'schlechter' ? TrendingDown :
    Minus;

  const headerBg =
    stats.trend === 'schlechter' ? 'bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800' :
    'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800';

  return (
    <div className={cn('rounded-xl border p-3 text-sm', headerBg)}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between gap-2"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2 font-semibold text-gray-800 dark:text-gray-100">
          <TrendIcon className={cn('h-4 w-4', trendColor)} />
          <span>Zubereitungs-Lernfortschritt</span>
          <span className={cn('text-xs font-normal', trendColor)}>
            Ø {stats.avgActual} Min · {stats.einhaltungsQuote}% im Ziel
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 shrink-0 text-gray-400" /> : <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {/* Summary bar */}
          <div className="flex items-center gap-3 rounded-lg bg-white/60 dark:bg-black/20 p-2.5">
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                <span>Einhaltungsquote</span>
                <span className="font-bold tabular-nums">{stats.einhaltungsQuote}%</span>
              </div>
              <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', stats.einhaltungsQuote >= 75 ? 'bg-emerald-500' : stats.einhaltungsQuote >= 50 ? 'bg-amber-400' : 'bg-red-400')}
                  style={{ width: `${stats.einhaltungsQuote}%` }}
                />
              </div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-gray-500">Trend</div>
              <div className={cn('text-xs font-bold', trendColor)}>
                {stats.trend === 'besser' ? '↑ Besser' : stats.trend === 'schlechter' ? '↓ Schlechter' : '→ Gleich'}
              </div>
            </div>
          </div>

          {/* Last 5 entries */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              Letzte {stats.entries.length} abgeschlossene Bestellungen
            </div>
            {stats.entries.map(e => (
              <div key={e.orderId} className="flex items-center gap-2 rounded-lg bg-white/70 dark:bg-black/20 px-2.5 py-1.5">
                <span className="w-10 shrink-0 font-mono text-[11px] font-bold text-gray-600 dark:text-gray-300">
                  #{e.displayId}
                </span>
                <div className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full', e.eingehalten ? 'bg-emerald-400' : 'bg-red-400')}
                    style={{ width: `${Math.min(100, (e.tatsaechlicheZeit / 30) * 100)}%` }}
                  />
                </div>
                <span className={cn('w-14 shrink-0 text-right text-[11px] font-bold tabular-nums', e.eingehalten ? 'text-emerald-600' : 'text-red-500')}>
                  {e.tatsaechlicheZeit} Min
                </span>
                <span className={cn('w-12 shrink-0 text-right text-[10px] tabular-nums', e.abweichung > 0 ? 'text-red-400' : 'text-emerald-400')}>
                  {e.abweichung > 0 ? `+${e.abweichung}` : e.abweichung}
                </span>
              </div>
            ))}
          </div>

          <div className="text-[10px] text-gray-400 dark:text-gray-500 text-right">
            Ziel: {ZIEL_PREP_MIN} Min · {stats.total} Bestellungen heute
          </div>
        </div>
      )}
    </div>
  );
}
