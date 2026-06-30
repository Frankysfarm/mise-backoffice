'use client';

/**
 * Phase 520 — LieferdienstOrderFrequenzHeatmap
 *
 * 7×24-Heatmap der Bestellfrequenz (Wochentag × Stunde).
 * Zeigt welche Stunden und Wochentage besonders viele Bestellungen haben.
 * Basis: letzte 8 Wochen historische Daten.
 *
 * Pollt alle 5 Min /api/delivery/admin/order-frequency-heatmap.
 */

import { useEffect, useState, useCallback } from 'react';
import { BarChart3, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FrequencyCell {
  dow: number;
  hour: number;
  avgOrders: number;
  peakClass: 'low' | 'normal' | 'peak' | 'high';
}

interface FrequencyData {
  cells: FrequencyCell[];
  peakCell: { dow: number; hour: number; avgOrders: number } | null;
  weekdayTotals: { dow: number; label: string; avgDailyOrders: number }[];
  hourTotals: { hour: number; avgHourlyOrders: number }[];
  basisWeeks: number;
}

interface Props {
  locationId: string;
}

const DOW_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const PEAK_COLORS: Record<string, string> = {
  low: 'bg-slate-100 dark:bg-slate-800 text-slate-400',
  normal: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  peak: 'bg-blue-300 dark:bg-blue-700/60 text-blue-900 dark:text-blue-100',
  high: 'bg-blue-500 dark:bg-blue-500 text-white',
};

const VISIBLE_HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];

export function LieferdienstOrderFrequenzHeatmap({ locationId }: Props) {
  const [data, setData] = useState<FrequencyData | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<{ dow: number; hour: number; avg: number } | null>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ location_id: locationId, weeks: '8' });
      const res = await fetch(`/api/delivery/admin/order-frequency-heatmap?${params}`);
      if (!res.ok) return;
      const json = await res.json();
      if (json.ok) setData(json.data as FrequencyData);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 5 * 60_000);
    return () => clearInterval(id);
  }, [load]);

  const getCell = (dow: number, hour: number) =>
    data?.cells.find((c) => c.dow === dow && c.hour === hour);

  const peakLabel = data?.peakCell
    ? `${DOW_LABELS[data.peakCell.dow]} ${data.peakCell.hour}:00 (Ø ${data.peakCell.avgOrders})`
    : null;

  return (
    <div className="rounded-xl border bg-card">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-indigo-500" />
          <span className="font-semibold text-sm">Bestellfrequenz-Heatmap</span>
          {peakLabel && !open && (
            <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">Peak: {peakLabel}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <span className="text-xs text-muted-foreground">{data.basisWeeks} Wochen Basis</span>
          )}
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4">
          {loading && <p className="text-xs text-muted-foreground py-4 text-center">Lade Daten…</p>}

          {data && (
            <>
              {/* Heatmap Grid */}
              <div className="overflow-x-auto">
                <table className="text-xs w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left pr-2 py-1 font-medium text-muted-foreground w-8">Tag</th>
                      {VISIBLE_HOURS.map((h) => (
                        <th key={h} className={cn('text-center py-1 font-normal text-muted-foreground', h % 2 === 0 ? '' : 'opacity-0')}>
                          {h}
                        </th>
                      ))}
                      <th className="pl-2 text-right font-medium text-muted-foreground">Ø/Tag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 7 }, (_, dow) => {
                      const wt = data.weekdayTotals[dow];
                      return (
                        <tr key={dow}>
                          <td className="pr-2 py-0.5 font-medium text-muted-foreground">{DOW_LABELS[dow]}</td>
                          {VISIBLE_HOURS.map((h) => {
                            const cell = getCell(dow, h);
                            const isTooltip = tooltip?.dow === dow && tooltip?.hour === h;
                            return (
                              <td key={h} className="p-0.5">
                                <div
                                  className={cn(
                                    'h-6 w-6 rounded flex items-center justify-center cursor-default relative',
                                    PEAK_COLORS[cell?.peakClass ?? 'low']
                                  )}
                                  onMouseEnter={() => setTooltip({ dow, hour: h, avg: cell?.avgOrders ?? 0 })}
                                  onMouseLeave={() => setTooltip(null)}
                                >
                                  {(cell?.avgOrders ?? 0) > 0 && (
                                    <span className="font-bold" style={{ fontSize: 9 }}>
                                      {cell!.avgOrders < 10 ? cell!.avgOrders.toFixed(1) : Math.round(cell!.avgOrders)}
                                    </span>
                                  )}
                                  {isTooltip && (
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-10 bg-popover border rounded px-2 py-1 shadow-md whitespace-nowrap pointer-events-none">
                                      <p className="font-semibold">{DOW_LABELS[dow]} {h}:00</p>
                                      <p className="text-muted-foreground">Ø {cell?.avgOrders ?? 0} Bestellungen</p>
                                    </div>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                          <td className="pl-2 text-right font-semibold">
                            {wt?.avgDailyOrders.toFixed(0)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Legende */}
              <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                <span className="font-medium">Auslastung:</span>
                {(['low', 'normal', 'peak', 'high'] as const).map((cls) => (
                  <span key={cls} className="flex items-center gap-1">
                    <span className={cn('inline-block w-3 h-3 rounded', PEAK_COLORS[cls])} />
                    {cls === 'low' ? 'Ruhig' : cls === 'normal' ? 'Normal' : cls === 'peak' ? 'Stark' : 'Hoch'}
                  </span>
                ))}
              </div>

              {/* Peak Info */}
              {peakLabel && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Stärkste Stunde: <span className="font-semibold text-foreground">{peakLabel}</span>
                  {' '}· Basis: {data.basisWeeks} Wochen
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
