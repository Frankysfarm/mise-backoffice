'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1128 — Tages-Bestellmuster-Heatmap (Kitchen)
// 7×24-Matrix: Bestellhäufigkeit nach Wochentag × Stunde letzte 4 Wochen

interface Props { locationId: string | null }

type Cell = {
  wochentag: number;
  stunde: number;
  anzahl: number;
  intensitaet: 'leer' | 'niedrig' | 'mittel' | 'hoch' | 'peak';
};

type ApiData = {
  matrix: Cell[][];
  max_anzahl: number;
  peak_wochentag: number;
  peak_stunde: number;
  location_id: string | null;
  generiert_am: string;
};

const WOCHENTAGE_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const HOURS_SHOWN = [8, 10, 12, 14, 16, 18, 20, 22]; // Only label even hours

const INTENSITY_BG: Record<Cell['intensitaet'], string> = {
  leer:     'bg-muted/30',
  niedrig:  'bg-blue-200 dark:bg-blue-900/60',
  mittel:   'bg-blue-400 dark:bg-blue-700',
  hoch:     'bg-blue-600 dark:bg-blue-500',
  peak:     'bg-blue-800 dark:bg-blue-400',
};

const POLL_MS = 5 * 60_000;

export function KitchenPhase1128TagesBestellmusterHeatmap({ locationId }: Props) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/tages-bestellmuster-heatmap?location_id=${locationId}`);
      if (r.ok) setData(await r.json() as ApiData);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const t = setInterval(() => { void load(); }, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const peakDay = data ? WOCHENTAGE_SHORT[data.peak_wochentag] : '—';
  const peakHour = data ? `${data.peak_stunde}:00` : '—';

  return (
    <div className="rounded-xl border border-blue-300 bg-blue-50 shadow-sm overflow-hidden dark:border-blue-800 dark:bg-blue-950/40">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-blue-500 shrink-0" />
          <span className="font-bold text-sm text-blue-700 dark:text-blue-300">Bestellmuster-Heatmap (4 Wochen)</span>
          {loading && <Loader2 className="h-3 w-3 animate-spin text-blue-400" />}
          {data && <span className="text-[11px] text-blue-500">Peak: {peakDay} {peakHour}</span>}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-blue-500" /> : <ChevronDown className="h-4 w-4 text-blue-500" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {!data && !loading && (
            <p className="text-sm text-muted-foreground text-center py-4">Keine Daten verfügbar</p>
          )}
          {data && (
            <div className="overflow-x-auto">
              <div className="min-w-[480px]">
                {/* Hour axis labels */}
                <div className="flex mb-1 ml-8">
                  {Array.from({ length: 24 }, (_, h) => (
                    <div key={h} className="flex-1 text-center">
                      {HOURS_SHOWN.includes(h) && (
                        <span className="text-[9px] text-muted-foreground">{h}</span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Rows: one per weekday */}
                {data.matrix.map((row, d) => (
                  <div key={d} className="flex items-center gap-1 mb-0.5">
                    <span className="w-7 text-[10px] text-muted-foreground text-right shrink-0">
                      {WOCHENTAGE_SHORT[d]}
                    </span>
                    {row.map((cell, h) => (
                      <div
                        key={h}
                        title={`${WOCHENTAGE_SHORT[d]} ${h}:00 — ${cell.anzahl} Bestellungen/Woche`}
                        className={cn(
                          'flex-1 h-5 rounded-sm transition-colors',
                          INTENSITY_BG[cell.intensitaet],
                          data.peak_wochentag === d && data.peak_stunde === h
                            ? 'ring-1 ring-yellow-400'
                            : '',
                        )}
                      />
                    ))}
                  </div>
                ))}

                {/* Legend */}
                <div className="flex items-center gap-3 mt-2 justify-end">
                  <span className="text-[10px] text-muted-foreground">Wenig</span>
                  {(['leer', 'niedrig', 'mittel', 'hoch', 'peak'] as const).map(l => (
                    <div key={l} className={cn('h-3 w-6 rounded-sm', INTENSITY_BG[l])} />
                  ))}
                  <span className="text-[10px] text-muted-foreground">Viel</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
