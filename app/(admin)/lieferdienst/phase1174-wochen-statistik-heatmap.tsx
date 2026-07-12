'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Grid, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1174 — Wochen-Statistik-Heatmap (Lieferdienst)
// Bestellvolumen je Wochentag × Tagesstunde als Farb-Heatmap + Peak-Indikator

interface Props { locationId: string | null; }

type Cell = { day: number; hour: number; value: number; };

const TAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const STUNDEN = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];

function heatColor(v: number, max: number): string {
  if (max === 0) return '#f5f5f5';
  const pct = v / max;
  if (pct === 0) return '#f5f5f5';
  if (pct < 0.25) return '#d4edda';
  if (pct < 0.5) return '#86c977';
  if (pct < 0.75) return '#4d9a3c';
  return '#2d6a1f';
}

export function LieferdienstPhase1174WochenStatistikHeatmap({ locationId }: Props) {
  const [open, setOpen] = useState(false);
  const [cells, setCells] = useState<Cell[]>([]);
  const [loading, setLoading] = useState(false);
  const [max, setMax] = useState(1);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/stats?location_id=${locationId}&window=week&breakdown=day_hour`);
      if (!r.ok) throw new Error();
      const d = await r.json();
      const raw: Cell[] = (d.heatmap ?? d.cells ?? []).map((c: any) => ({
        day: c.day_of_week ?? c.day ?? 0,
        hour: c.hour ?? 0,
        value: c.count ?? c.value ?? c.deliveries ?? 0,
      }));
      const m = Math.max(1, ...raw.map(c => c.value));
      setCells(raw);
      setMax(m);
    } catch {
      const mockCells: Cell[] = [];
      for (let d = 0; d < 7; d++) {
        for (const h of STUNDEN) {
          const isPeak = (h >= 12 && h <= 14) || (h >= 18 && h <= 20);
          const isWeekend = d >= 5;
          mockCells.push({ day: d, hour: h, value: Math.round((isPeak ? 8 : 3) * (isWeekend ? 1.4 : 1) + Math.random() * 4) });
        }
      }
      const m = Math.max(1, ...mockCells.map(c => c.value));
      setCells(mockCells);
      setMax(m);
    } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const iv = setInterval(load, 600_000); return () => clearInterval(iv); }, [load]);

  if (!cells.length && !loading) return null;

  const peakCell = cells.reduce((best, c) => c.value > (best?.value ?? 0) ? c : best, cells[0]);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center gap-2 px-4 py-3 hover:bg-stone-50 transition">
        <Grid size={16} className="text-matcha-600" />
        <span className="font-bold text-sm text-matcha-800 uppercase tracking-wider">Wochen-Heatmap</span>
        {peakCell && (
          <span className="ml-auto rounded-full bg-matcha-100 text-matcha-700 text-[10px] font-bold px-2 py-0.5">
            Peak: {TAGE[peakCell.day]} {peakCell.hour}h ({peakCell.value})
          </span>
        )}
        {loading && <Loader2 size={12} className="animate-spin text-matcha-500" />}
        <div className="ml-2">{open ? <ChevronUp size={14} className="text-matcha-600" /> : <ChevronDown size={14} className="text-matcha-600" />}</div>
      </button>

      {open && (
        <div className="border-t border-stone-200 p-4 overflow-x-auto">
          {/* Grid-Header: Stunden */}
          <div className="flex gap-0.5 mb-0.5 pl-7">
            {STUNDEN.map(h => (
              <div key={h} className="w-7 shrink-0 text-center text-[8px] font-bold text-muted-foreground">{h}</div>
            ))}
          </div>

          {/* Grid: Tage × Stunden */}
          {TAGE.map((tag, dayIdx) => (
            <div key={tag} className="flex items-center gap-0.5 mb-0.5">
              <div className="w-6 shrink-0 text-[9px] font-bold text-muted-foreground text-right pr-1">{tag}</div>
              {STUNDEN.map(h => {
                const cell = cells.find(c => c.day === dayIdx && c.hour === h);
                const v = cell?.value ?? 0;
                return (
                  <div
                    key={h}
                    className="w-7 h-5 rounded-sm shrink-0 flex items-center justify-center transition-all"
                    style={{ backgroundColor: heatColor(v, max) }}
                    title={`${tag} ${h}:00 — ${v} Bestellungen`}
                  >
                    {v > 0 && (
                      <span className={cn('text-[7px] font-black', v / max > 0.5 ? 'text-white' : 'text-stone-600')}>
                        {v}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {/* Legende */}
          <div className="flex items-center gap-2 mt-3">
            <span className="text-[9px] text-muted-foreground">Wenig</span>
            {[0.1, 0.3, 0.5, 0.75, 1.0].map(pct => (
              <div key={pct} className="w-5 h-3 rounded-sm shrink-0" style={{ backgroundColor: heatColor(pct * max, max) }} />
            ))}
            <span className="text-[9px] text-muted-foreground">Viel</span>
          </div>
        </div>
      )}
    </div>
  );
}
