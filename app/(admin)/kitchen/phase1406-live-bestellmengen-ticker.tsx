'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1406 — Live-Bestellmengen-Ticker (Kitchen)
 *
 * Echtzeit-Bestellungen dieser Stunde + Hochrechnung auf Stunden-Ende + Vergleich Vorwoche.
 * Props-basiert — empfängt orders[] vom Kitchen-Client.
 */

interface Order {
  id: string;
  created_at?: string | null;
  status?: string | null;
}

interface Props {
  orders: Order[];
}

function formatTime(date: Date) {
  return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export function KitchenPhase1406LiveBestellmengenTicker({ orders }: Props) {
  const [open, setOpen] = useState(true);
  const [tick, setTick] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Force re-render every 30s for live clock
  useEffect(() => {
    timerRef.current = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const now = new Date();
  const hourStart = new Date(now);
  hourStart.setMinutes(0, 0, 0);
  const hourEnd = new Date(hourStart);
  hourEnd.setHours(hourEnd.getHours() + 1);

  const minutesElapsed = now.getMinutes() + now.getSeconds() / 60;
  const minutesLeft = 60 - minutesElapsed;

  // Bestellungen dieser Stunde
  const dieseStunde = orders.filter((o) => {
    const ts = o.created_at ? new Date(o.created_at) : null;
    return ts && ts >= hourStart && ts < hourEnd;
  });

  // Hochrechnung auf Stundenende
  const hochrechnung = minutesElapsed > 0
    ? Math.round((dieseStunde.length / minutesElapsed) * 60)
    : 0;

  // Vorwoche (Mock — Ø für diese Stunde)
  const stunde = now.getHours();
  const VORWOCHE_MOCK: Record<number, number> = {
    11: 12, 12: 18, 13: 15, 14: 10, 17: 14, 18: 22, 19: 25, 20: 20, 21: 12,
  };
  const vorwocheStunde = VORWOCHE_MOCK[stunde] ?? 8;
  const delta = hochrechnung - vorwocheStunde;
  const deltaPct = vorwocheStunde > 0 ? Math.round((delta / vorwocheStunde) * 100) : 0;

  const TrendIcon = delta > 2 ? TrendingUp : delta < -2 ? TrendingDown : Minus;
  const trendColor =
    delta > 2
      ? 'text-emerald-600 dark:text-emerald-400'
      : delta < -2
      ? 'text-rose-600 dark:text-rose-400'
      : 'text-slate-500 dark:text-slate-400';

  const urgency =
    hochrechnung > vorwocheStunde * 1.3
      ? { label: 'Hoch', bg: 'bg-rose-50 dark:bg-rose-950/20', border: 'border-rose-200 dark:border-rose-800', text: 'text-rose-700 dark:text-rose-300' }
      : hochrechnung > vorwocheStunde * 1.1
      ? { label: 'Erhöht', bg: 'bg-amber-50 dark:bg-amber-950/20', border: 'border-amber-200 dark:border-amber-700', text: 'text-amber-700 dark:text-amber-300' }
      : { label: 'Normal', bg: 'bg-emerald-50 dark:bg-emerald-950/20', border: 'border-emerald-200 dark:border-emerald-800', text: 'text-emerald-700 dark:text-emerald-300' };

  return (
    <div className={cn('rounded-xl border', urgency.border, urgency.bg, 'p-3 mb-2')}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 text-left"
      >
        <div className="flex items-center gap-2">
          <Activity className={cn('h-4 w-4', urgency.text)} />
          <span className={cn('text-sm font-bold', urgency.text)}>Live-Bestellmengen</span>
          <span className={cn('text-xs font-semibold px-1.5 py-0.5 rounded-full', urgency.bg, urgency.text, 'border', urgency.border)}>
            {urgency.label}
          </span>
        </div>
        <span className={cn('text-lg font-black tabular-nums', urgency.text)}>
          {dieseStunde.length} <span className="text-xs font-normal opacity-70">diese Std.</span>
        </span>
      </button>

      {open && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-white/60 dark:bg-white/5 border border-white/40 p-2 text-center">
            <div className="text-xs text-muted-foreground mb-0.5">Bisher</div>
            <div className={cn('text-xl font-black tabular-nums', urgency.text)}>{dieseStunde.length}</div>
            <div className="text-xs text-muted-foreground">{formatTime(hourStart)}–jetzt</div>
          </div>

          <div className="rounded-lg bg-white/60 dark:bg-white/5 border border-white/40 p-2 text-center">
            <div className="text-xs text-muted-foreground mb-0.5">Hochrechnung</div>
            <div className="text-xl font-black tabular-nums text-slate-800 dark:text-slate-100">{hochrechnung}</div>
            <div className="text-xs text-muted-foreground">bis {formatTime(hourEnd)}</div>
          </div>

          <div className="rounded-lg bg-white/60 dark:bg-white/5 border border-white/40 p-2 text-center">
            <div className="text-xs text-muted-foreground mb-0.5">Vorwoche Ø</div>
            <div className="text-xl font-black tabular-nums text-slate-800 dark:text-slate-100">{vorwocheStunde}</div>
            <div className={cn('text-xs font-semibold flex items-center justify-center gap-0.5', trendColor)}>
              <TrendIcon className="h-3 w-3" />
              {delta > 0 ? '+' : ''}{deltaPct}%
            </div>
          </div>

          <div className="col-span-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>Stunden-Fortschritt</span>
              <span>{Math.round(minutesElapsed)}min / 60min</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', urgency.text.replace('text-', 'bg-'))}
                style={{ width: `${Math.min(100, (minutesElapsed / 60) * 100).toFixed(1)}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
