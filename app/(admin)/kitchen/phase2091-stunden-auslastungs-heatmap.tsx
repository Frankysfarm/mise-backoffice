'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { BarChart2, ChevronDown, ChevronUp, Lightbulb } from 'lucide-react';

interface Order {
  id: string;
  status: string;
  bestellt_am: string | null;
}

interface Props {
  orders: Order[];
}

type Level = 'low' | 'medium' | 'high' | 'peak';

function level(count: number, max: number): Level {
  if (max === 0) return 'low';
  const pct = count / max;
  if (pct >= 0.8) return 'peak';
  if (pct >= 0.5) return 'high';
  if (pct >= 0.2) return 'medium';
  return 'low';
}

const LEVEL_STYLE: Record<Level, string> = {
  low:    'bg-matcha-100 text-matcha-700',
  medium: 'bg-amber-100 text-amber-700',
  high:   'bg-orange-200 text-orange-800',
  peak:   'bg-red-200 text-red-800 font-black',
};

const LEVEL_LABEL: Record<Level, string> = {
  low:    'Niedrig',
  medium: 'Mittel',
  high:   'Hoch',
  peak:   'Peak',
};

export function KitchenPhase2091StundenAuslastungsHeatmap({ orders }: Props) {
  const [open, setOpen] = useState(true);

  const { stunden, maxCount, peakH, naechsteH, batchTipp } = useMemo(() => {
    const map: Record<number, number> = {};
    for (const o of orders) {
      if (!o.bestellt_am) continue;
      const h = new Date(o.bestellt_am).getHours();
      map[h] = (map[h] ?? 0) + 1;
    }

    const nowH = new Date().getHours();
    const stunden = Array.from({ length: 24 }, (_, h) => ({ h, count: map[h] ?? 0 }));
    const maxCount = Math.max(...stunden.map(s => s.count), 1);
    const peakH = stunden.reduce((best, s) => s.count > best.count ? s : best, stunden[0]).h;

    // prognose nächste Stunde: avg current ±1 (simplified)
    const naechsteH = nowH < 23 ? (map[nowH + 1] ?? Math.round((map[nowH] ?? 0) * 0.9)) : 0;
    const currentLevel = level(map[nowH] ?? 0, maxCount);
    const batchTipp = currentLevel === 'peak' || currentLevel === 'high'
      ? 'Hohe Auslastung — Batches bündeln und Puffer einplanen!'
      : currentLevel === 'medium'
      ? 'Mittlere Auslastung — Vorbereitung für nächste Stunde prüfen.'
      : null;

    return { stunden, maxCount, peakH, naechsteH, batchTipp };
  }, [orders]);

  const nowH = new Date().getHours();
  const visibleStunden = stunden.filter(s => s.h <= nowH);

  if (orders.length === 0) return null;

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 border-b hover:bg-muted/30 transition-colors"
      >
        <BarChart2 className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Stunden-Auslastung</span>
        {level(stunden[nowH]?.count ?? 0, maxCount) === 'peak' && (
          <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[9px] font-black animate-pulse">
            Peak jetzt
          </span>
        )}
        <span className="ml-auto font-mono text-sm font-black text-matcha-700">{stunden[nowH]?.count ?? 0}</span>
        <span className="text-[10px] text-muted-foreground">diese Stunde</span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground ml-1" /> : <ChevronDown className="h-4 w-4 text-muted-foreground ml-1" />}
      </button>

      {open && (
        <div className="p-4 space-y-3">
          {/* Heatmap grid — 8 per row */}
          <div className="grid grid-cols-8 gap-1">
            {visibleStunden.map(({ h, count }) => {
              const lv = level(count, maxCount);
              const isNow = h === nowH;
              return (
                <div
                  key={h}
                  title={`${h}:00 — ${count} Bestellungen (${LEVEL_LABEL[lv]})`}
                  className={cn(
                    'rounded p-1.5 text-center transition-all',
                    LEVEL_STYLE[lv],
                    isNow && 'ring-2 ring-matcha-600 ring-offset-1',
                  )}
                >
                  <div className="text-[9px] font-bold tabular-nums">{h}</div>
                  <div className="text-[10px] font-black tabular-nums">{count}</div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-2 flex-wrap">
            {(['low', 'medium', 'high', 'peak'] as Level[]).map(lv => (
              <span key={lv} className={cn('rounded px-1.5 py-0.5 text-[9px] font-bold', LEVEL_STYLE[lv])}>
                {LEVEL_LABEL[lv]}
              </span>
            ))}
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-muted/40 p-2 text-center">
              <div className="text-[9px] text-muted-foreground uppercase">Peak-Std</div>
              <div className="text-sm font-black tabular-nums">{peakH}:00</div>
            </div>
            <div className="rounded-lg bg-muted/40 p-2 text-center">
              <div className="text-[9px] text-muted-foreground uppercase">Jetzt</div>
              <div className={cn('text-sm font-black tabular-nums', LEVEL_STYLE[level(stunden[nowH]?.count ?? 0, maxCount)].split(' ')[1])}>
                {stunden[nowH]?.count ?? 0}
              </div>
            </div>
            <div className="rounded-lg bg-muted/40 p-2 text-center">
              <div className="text-[9px] text-muted-foreground uppercase">Prognose +1h</div>
              <div className="text-sm font-black tabular-nums">{naechsteH}</div>
            </div>
          </div>

          {/* Batch-Empfehlung */}
          {batchTipp && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
              <Lightbulb className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">{batchTipp}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
