'use client';

/**
 * AuslastungsHeatmap — Phase 138
 * Echtzeit-Auslastungs-Heatmap: Stunden (0-23) × Wochentage (Mo-So)
 * Zeigt historisches Bestellvolumen-Muster der letzten 8 Wochen.
 * Hilft Dispatch bei Schicht- und Kapazitätsplanung.
 */

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { BarChart3, RefreshCw, Info } from 'lucide-react';

interface HeatmapCell {
  hour: number;
  weekday: number; // 0=Mo, 6=So
  avg_orders: number;
  max_orders: number;
  total_orders: number;
  weeks_with_data: number;
}

const WEEKDAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

// Stunden-Gruppen für kompakte Darstellung
const HOUR_GROUPS = [
  { label: '0–5',  hours: [0, 1, 2, 3, 4, 5] },
  { label: '6–9',  hours: [6, 7, 8, 9] },
  { label: '10–11', hours: [10, 11] },
  { label: '12–13', hours: [12, 13] },
  { label: '14–15', hours: [14, 15] },
  { label: '16–17', hours: [16, 17] },
  { label: '18–19', hours: [18, 19] },
  { label: '20–21', hours: [20, 21] },
  { label: '22–23', hours: [22, 23] },
];

function heatColor(avg: number, peak: number): string {
  if (peak === 0 || avg === 0) return 'bg-muted/30 text-muted-foreground/30';
  const ratio = avg / peak;
  if (ratio >= 0.8) return 'bg-red-500 text-white';
  if (ratio >= 0.6) return 'bg-orange-400 text-white';
  if (ratio >= 0.4) return 'bg-amber-300 text-amber-900';
  if (ratio >= 0.2) return 'bg-lime-300 text-lime-900';
  return 'bg-emerald-100 text-emerald-700';
}

function aggregateGroup(cells: HeatmapCell[], hours: number[], weekday: number): number {
  return cells
    .filter((c) => c.weekday === weekday && hours.includes(c.hour))
    .reduce((s, c) => s + c.avg_orders, 0);
}

interface Props {
  locationId: string | undefined;
}

export function AuslastungsHeatmap({ locationId }: Props) {
  const [cells, setCells] = useState<HeatmapCell[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weeks, setWeeks] = useState(8);
  const [hoveredCell, setHoveredCell] = useState<{ group: number; weekday: number; avg: number } | null>(null);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/delivery/admin/utilization-heatmap?location_id=${locationId}&weeks=${weeks}`);
      if (!res.ok) throw new Error('Fehler beim Laden');
      const data = await res.json() as { cells: HeatmapCell[] };
      setCells(data.cells ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  }, [locationId, weeks]);

  useEffect(() => { load(); }, [load]);

  if (!locationId) return null;

  // Peak-Wert für normalisierte Farbskala
  const peak = cells.length > 0 ? Math.max(...cells.map((c) => c.avg_orders), 0.1) : 0.1;

  // Aggregierte Werte pro Gruppe × Wochentag
  const gridValues = HOUR_GROUPS.map((group) =>
    WEEKDAY_LABELS.map((_, wd) => aggregateGroup(cells, group.hours, wd))
  );
  const gridPeak = Math.max(...gridValues.flat(), 0.1);

  // Busiest slot
  let busiestGroup = 0;
  let busiestDay = 0;
  let busiestVal = 0;
  gridValues.forEach((row, gi) =>
    row.forEach((v, di) => {
      if (v > busiestVal) { busiestVal = v; busiestGroup = gi; busiestDay = di; }
    })
  );

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-2.5 bg-muted/30">
        <BarChart3 className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Auslastungs-Heatmap
        </span>
        <span className="text-[10px] text-muted-foreground">Stunden × Wochentag</span>
        <div className="ml-auto flex items-center gap-2">
          {/* Wochen-Selector */}
          <select
            value={weeks}
            onChange={(e) => setWeeks(Number(e.target.value))}
            className="text-[10px] rounded border border-border bg-background px-1.5 py-0.5 text-muted-foreground"
          >
            <option value={4}>4 Wochen</option>
            <option value={8}>8 Wochen</option>
            <option value={12}>12 Wochen</option>
          </select>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="p-1 rounded hover:bg-muted transition disabled:opacity-40"
            aria-label="Aktualisieren"
          >
            <RefreshCw className={cn('h-3.5 w-3.5 text-muted-foreground', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      <div className="p-3">
        {error && (
          <div className="text-xs text-red-500 text-center py-2">{error}</div>
        )}

        {!error && (
          <>
            {/* Busiest-Banner */}
            {busiestVal > 0 && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-1.5 mb-3 flex items-center gap-2">
                <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider">Stoßzeit</span>
                <span className="text-[11px] font-black text-red-800">
                  {WEEKDAY_LABELS[busiestDay]}, {HOUR_GROUPS[busiestGroup].label} Uhr
                </span>
                <span className="ml-auto text-[10px] text-red-600">Ø {busiestVal.toFixed(1)} Bestellungen</span>
              </div>
            )}

            {/* Heatmap Grid */}
            <div className="overflow-x-auto">
              <table className="w-full text-[10px] border-separate border-spacing-0.5">
                <thead>
                  <tr>
                    <th className="text-[9px] font-bold text-muted-foreground text-left pr-2 pb-1 w-14">Uhrzeit</th>
                    {WEEKDAY_LABELS.map((d) => (
                      <th key={d} className="text-[9px] font-bold text-muted-foreground text-center pb-1 w-8">{d}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {HOUR_GROUPS.map((group, gi) => (
                    <tr key={group.label}>
                      <td className="text-[9px] text-muted-foreground pr-2 py-0.5 font-mono whitespace-nowrap">
                        {group.label}
                      </td>
                      {WEEKDAY_LABELS.map((_, di) => {
                        const val = gridValues[gi][di];
                        const colorClass = heatColor(val, gridPeak);
                        const isHovered = hoveredCell?.group === gi && hoveredCell?.weekday === di;
                        return (
                          <td
                            key={di}
                            onMouseEnter={() => setHoveredCell({ group: gi, weekday: di, avg: val })}
                            onMouseLeave={() => setHoveredCell(null)}
                            className={cn(
                              'rounded text-center py-1.5 cursor-default transition-all',
                              colorClass,
                              isHovered && 'ring-2 ring-foreground/30 scale-110 z-10 relative',
                            )}
                            title={`${WEEKDAY_LABELS[di]} ${group.label} Uhr: Ø ${val.toFixed(1)} Bestellungen`}
                          >
                            {val > 0 ? val.toFixed(val >= 10 ? 0 : 1) : '·'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Tooltip */}
            {hoveredCell && hoveredCell.avg > 0 && (
              <div className="mt-2 text-center text-[10px] text-muted-foreground bg-muted/40 rounded-lg py-1.5 px-3">
                <span className="font-bold text-foreground">
                  {WEEKDAY_LABELS[hoveredCell.weekday]}, {HOUR_GROUPS[hoveredCell.group].label} Uhr
                </span>
                {' · '}Ø <span className="font-bold">{hoveredCell.avg.toFixed(1)}</span> Bestellungen/h
              </div>
            )}

            {/* Legende */}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Intensität:</span>
              {[
                { color: 'bg-emerald-100', label: 'Gering' },
                { color: 'bg-lime-300', label: '' },
                { color: 'bg-amber-300', label: 'Mittel' },
                { color: 'bg-orange-400', label: '' },
                { color: 'bg-red-500', label: 'Hoch' },
              ].map((l, i) => (
                <div key={i} className="flex items-center gap-1">
                  <div className={cn('w-3 h-3 rounded', l.color)} />
                  {l.label && <span className="text-[9px] text-muted-foreground">{l.label}</span>}
                </div>
              ))}
              <span className="ml-auto text-[9px] text-muted-foreground">
                Basis: {weeks} Wochen · Ø Bestellungen je Slot
              </span>
            </div>
          </>
        )}

        {loading && cells.length === 0 && (
          <div className="text-center py-6 text-xs text-muted-foreground animate-pulse">
            Lade Heatmap…
          </div>
        )}
      </div>
    </div>
  );
}
