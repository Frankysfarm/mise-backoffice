'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { BarChart2, ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from '@/components/ui/card';

// Phase 1461 — Bestellvolumen-Heatmap (Kitchen)
// 7×24-Grid der letzten Woche; Farbtiefe nach Bestellanzahl; Props-basiert; nach Phase1459.

interface Order {
  id: string;
  bestellt_am?: string | null;
  status?: string | null;
}

interface Props {
  orders: Order[];
  locationId?: string | null;
}

const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function heatColor(val: number, max: number): string {
  if (max === 0 || val === 0) return 'bg-slate-100 dark:bg-slate-800';
  const ratio = val / max;
  if (ratio < 0.2)  return 'bg-blue-100 dark:bg-blue-900/40';
  if (ratio < 0.4)  return 'bg-blue-200 dark:bg-blue-800/60';
  if (ratio < 0.6)  return 'bg-blue-400 dark:bg-blue-700';
  if (ratio < 0.8)  return 'bg-blue-600 dark:bg-blue-500';
  return 'bg-blue-800 dark:bg-blue-400';
}

function textColor(val: number, max: number): string {
  if (max === 0 || val === 0) return 'text-slate-300';
  const ratio = val / max;
  return ratio >= 0.6 ? 'text-white' : 'text-blue-900 dark:text-white';
}

export function KitchenPhase1461BestellvolumenHeatmap({ orders, locationId: _locationId }: Props) {
  const [open, setOpen] = useState(true);

  const { grid, maxVal, dayLabels } = useMemo(() => {
    // grid[dayOffset 0-6][hour 0-23] = count
    const g: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    orders.forEach(o => {
      if (!o.bestellt_am) return;
      const d = new Date(o.bestellt_am);
      const dayOffset = Math.floor((startOfToday.getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86_400_000);
      if (dayOffset < 0 || dayOffset >= 7) return;
      const h = d.getHours();
      g[6 - dayOffset][h]++;
    });

    let mx = 0;
    g.forEach(row => row.forEach(v => { if (v > mx) mx = v; }));

    // Build day labels: past 7 days ending today
    const labels: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const dt = new Date(startOfToday.getTime() - i * 86_400_000);
      labels.push(DAYS[dt.getDay() === 0 ? 6 : dt.getDay() - 1]);
    }

    return { grid: g, maxVal: mx, dayLabels: labels };
  }, [orders]);

  // Show only hours 6–22 to save space
  const visibleHours = HOURS.filter(h => h >= 6 && h <= 22);

  return (
    <Card className="p-4 space-y-3">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-blue-600" />
          <span className="font-semibold text-sm">Bestellvolumen letzte 7 Tage</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {open && (
        <div className="overflow-x-auto">
          <table className="text-[10px] border-separate border-spacing-0.5 min-w-max">
            <thead>
              <tr>
                <th className="w-7 text-right pr-1 text-slate-400 font-normal"></th>
                {visibleHours.map(h => (
                  <th key={h} className="w-6 text-center text-slate-400 font-normal">
                    {h % 3 === 0 ? `${h}` : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.map((row, di) => (
                <tr key={di}>
                  <td className="text-right pr-1 text-slate-500 font-medium">{dayLabels[di]}</td>
                  {visibleHours.map(h => {
                    const val = row[h];
                    return (
                      <td
                        key={h}
                        title={`${dayLabels[di]} ${h}:00 — ${val} Bestellungen`}
                        className={cn(
                          'w-6 h-5 rounded-sm text-center leading-5 cursor-default transition-colors',
                          heatColor(val, maxVal),
                          textColor(val, maxVal),
                        )}
                      >
                        {val > 0 ? val : ''}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Legende */}
          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-500">
            <span>Niedrig</span>
            {['bg-blue-100', 'bg-blue-200', 'bg-blue-400', 'bg-blue-600', 'bg-blue-800'].map(c => (
              <span key={c} className={cn('w-4 h-3 rounded-sm inline-block', c)} />
            ))}
            <span>Hoch</span>
            {maxVal > 0 && <span className="ml-2 text-slate-400">Max: {maxVal} Best./Std.</span>}
          </div>
        </div>
      )}

      {!open && maxVal > 0 && (
        <p className="text-xs text-slate-500">Peak: {maxVal} Bestellungen/Stunde</p>
      )}
    </Card>
  );
}
