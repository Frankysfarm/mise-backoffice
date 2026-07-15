'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { BarChart2 } from 'lucide-react';

/**
 * Phase 1673 — Bestellungs-Volumen-Heatmap (Kitchen)
 *
 * Stunden (0–23) x Wochentage (Mo–So) als CSS-Grid-Heatmap.
 * Intensität = Bestellmenge je Zelle relativ zum Maximum.
 * Props-basiert, useMemo.
 */

interface Order {
  id: string;
  created_at?: string | null;
  status?: string | null;
}

interface Props {
  orders: Order[];
}

const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

// ISO weekday: getDay() returns 0=Sun,1=Mon...6=Sat → map to 0=Mon...6=Sun
function isoWeekday(d: Date): number {
  return (d.getDay() + 6) % 7;
}

function intensityClass(ratio: number): string {
  if (ratio === 0) return 'bg-muted/30';
  if (ratio < 0.2) return 'bg-amber-100 dark:bg-amber-900/30';
  if (ratio < 0.4) return 'bg-amber-200 dark:bg-amber-800/50';
  if (ratio < 0.6) return 'bg-amber-300 dark:bg-amber-700/60';
  if (ratio < 0.8) return 'bg-amber-400 dark:bg-amber-600/70';
  return 'bg-amber-500 dark:bg-amber-500/80';
}

export function KitchenPhase1673BestellungsVolumenHeatmap({ orders }: Props) {
  const { grid, maxVal } = useMemo(() => {
    // grid[dayIndex][hour] = count
    const g: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));
    for (const o of orders) {
      if (!o.created_at) continue;
      const d = new Date(o.created_at);
      if (isNaN(d.getTime())) continue;
      const day = isoWeekday(d);
      const hour = d.getHours();
      g[day][hour]++;
    }
    const maxVal = Math.max(1, ...g.flat());
    return { grid: g, maxVal };
  }, [orders]);

  const hasDaten = orders.length > 0;

  // Peak-Stunden (Stunden mit ≥70% des Max)
  const peakHours = useMemo(() => {
    const hourTotals = HOURS.map(h => DAYS.reduce((s, _, d) => s + grid[d][h], 0));
    const peakMax = Math.max(1, ...hourTotals);
    return hourTotals.map(v => v / peakMax >= 0.7);
  }, [grid]);

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b">
        <BarChart2 className="h-4 w-4 text-amber-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
          Bestellungs-Volumen-Heatmap
        </span>
        {hasDaten && (
          <span className="ml-auto text-[10px] text-muted-foreground">{orders.length} Bestellungen</span>
        )}
      </div>

      {!hasDaten ? (
        <div className="px-4 py-6 text-sm text-muted-foreground text-center">
          Keine Bestelldaten verfügbar.
        </div>
      ) : (
        <div className="p-3 overflow-x-auto">
          {/* Stunden-Header */}
          <div className="flex items-center mb-1">
            <div className="w-6 shrink-0" />
            <div className="flex gap-px">
              {HOURS.map(h => (
                <div
                  key={h}
                  className={cn(
                    'w-5 text-center text-[8px] font-bold shrink-0',
                    peakHours[h] ? 'text-amber-600' : 'text-muted-foreground',
                  )}
                >
                  {h % 3 === 0 ? h : ''}
                </div>
              ))}
            </div>
          </div>

          {/* Heatmap-Zeilen */}
          {DAYS.map((day, d) => (
            <div key={day} className="flex items-center gap-px mb-px">
              <div className="w-6 text-[9px] font-bold text-muted-foreground shrink-0">{day}</div>
              <div className="flex gap-px">
                {HOURS.map(h => {
                  const count = grid[d][h];
                  const ratio = count / maxVal;
                  return (
                    <div
                      key={h}
                      className={cn('w-5 h-4 rounded-sm shrink-0 transition-colors', intensityClass(ratio))}
                      title={`${day} ${h}:00 — ${count} Bestellungen`}
                    />
                  );
                })}
              </div>
            </div>
          ))}

          {/* Legende */}
          <div className="flex items-center gap-2 mt-3 pt-2 border-t">
            <span className="text-[9px] text-muted-foreground">Wenig</span>
            {[0, 0.2, 0.4, 0.6, 0.8, 1].map(r => (
              <div key={r} className={cn('w-4 h-3 rounded-sm', intensityClass(r === 0 ? 0 : r))} />
            ))}
            <span className="text-[9px] text-muted-foreground">Viel</span>
            <span className="ml-auto text-[9px] text-muted-foreground">Max: {maxVal}</span>
          </div>
        </div>
      )}
    </div>
  );
}
