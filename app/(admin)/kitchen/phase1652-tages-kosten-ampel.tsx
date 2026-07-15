'use client';

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface OrderInput {
  id: string;
  status: string;
  bestellt_am?: string | null;
  gesamtbetrag?: number | null;
}

interface Props {
  orders: OrderInput[];
  tageBudgetEur?: number;
}

type AmpelLevel = 'normal' | 'achtung' | 'kritisch';

const MATERIAL_RATIO = 0.30; // 30% der Bestellung = Materialkosten (Näherungswert)
const DEFAULT_BUDGET = 500;

function levelOf(pct: number): AmpelLevel {
  if (pct < 70) return 'normal';
  if (pct < 90) return 'achtung';
  return 'kritisch';
}

const LEVEL_STYLE: Record<AmpelLevel, { bg: string; border: string; dot: string; text: string; label: string }> = {
  normal:   { bg: 'bg-emerald-50 dark:bg-emerald-950/20', border: 'border-emerald-200 dark:border-emerald-900', dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400', label: 'Normal' },
  achtung:  { bg: 'bg-amber-50 dark:bg-amber-950/20',   border: 'border-amber-200 dark:border-amber-900',   dot: 'bg-amber-400',   text: 'text-amber-700 dark:text-amber-400',   label: 'Achtung' },
  kritisch: { bg: 'bg-red-50 dark:bg-red-950/20',       border: 'border-red-200 dark:border-red-900',       dot: 'bg-red-500 animate-pulse', text: 'text-red-700 dark:text-red-400', label: 'Kritisch' },
};

function fmtEur(n: number) {
  return n.toFixed(2).replace('.', ',') + ' €';
}

export function KitchenPhase1652TagesKostenAmpel({ orders, tageBudgetEur = DEFAULT_BUDGET }: Props) {
  const { kostenGesamt, stunden, level, auslastungPct } = useMemo(() => {
    const done = orders.filter((o) => ['geliefert', 'abgeschlossen', 'pending', 'preparing', 'ready', 'bestätigt', 'in_zubereitung', 'neu'].includes(o.status));
    const kostenGesamt = done.reduce((acc, o) => acc + (o.gesamtbetrag ?? 15) * MATERIAL_RATIO, 0);
    const auslastungPct = Math.min(100, (kostenGesamt / tageBudgetEur) * 100);

    // Stunden-Buckets (0–23h)
    const buckets: Record<number, number> = {};
    for (const o of done) {
      const h = o.bestellt_am ? new Date(o.bestellt_am).getUTCHours() : new Date().getUTCHours();
      buckets[h] = (buckets[h] ?? 0) + (o.gesamtbetrag ?? 15) * MATERIAL_RATIO;
    }
    const nowH = new Date().getUTCHours();
    const stunden = Array.from({ length: 24 }, (_, h) => ({ h, kosten: buckets[h] ?? 0, isCurrent: h === nowH }));

    return { kostenGesamt, stunden, level: levelOf(auslastungPct), auslastungPct };
  }, [orders, tageBudgetEur]);

  const style = LEVEL_STYLE[level];
  const maxBucket = Math.max(...stunden.map((s) => s.kosten), 1);

  return (
    <div className={cn('rounded-xl border p-4 space-y-3', style.bg, style.border)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn('h-2.5 w-2.5 rounded-full', style.dot)} />
          <span className="text-sm font-bold">Tages-Kosten-Ampel</span>
          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', style.text, 'bg-white/60 dark:bg-black/20')}>
            {style.label}
          </span>
        </div>
        <span className={cn('text-xs font-bold tabular-nums', style.text)}>
          {fmtEur(kostenGesamt)} / {fmtEur(tageBudgetEur)}
        </span>
      </div>

      {/* Fortschrittsbalken */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>Materialkosten-Auslastung</span>
          <span className="font-bold tabular-nums">{Math.round(auslastungPct)}%</span>
        </div>
        <div className="h-2 rounded-full bg-black/10 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-500', level === 'kritisch' ? 'bg-red-500' : level === 'achtung' ? 'bg-amber-400' : 'bg-emerald-500')}
            style={{ width: `${auslastungPct}%` }}
          />
        </div>
      </div>

      {/* Stunden-Balken-Chart */}
      <div>
        <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Materialkosten je Stunde</div>
        <div className="flex items-end gap-px h-12">
          {stunden.map(({ h, kosten, isCurrent }) => {
            const hPct = maxBucket > 0 ? (kosten / maxBucket) * 100 : 0;
            return (
              <div
                key={h}
                className="flex-1 flex flex-col items-center justify-end"
                title={`${h}:00 — ${fmtEur(kosten)}`}
              >
                <div
                  className={cn(
                    'w-full rounded-sm transition-all',
                    isCurrent ? (level === 'kritisch' ? 'bg-red-500' : level === 'achtung' ? 'bg-amber-400' : 'bg-emerald-500') : 'bg-muted-foreground/30',
                  )}
                  style={{ height: `${Math.max(hPct, 2)}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-0.5 text-[8px] text-muted-foreground">
          <span>0h</span>
          <span>12h</span>
          <span>23h</span>
        </div>
      </div>
    </div>
  );
}
