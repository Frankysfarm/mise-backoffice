'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { BarChart3 } from 'lucide-react';

interface HeatmapCell {
  hour: number;
  weekday: number;
  avg_orders: number;
  max_orders: number;
  total_orders: number;
  weeks_with_data: number;
}

interface HeatmapData {
  cells: HeatmapCell[];
  weeks: number;
  since: string;
}

const WEEKS_OPTIONS = [4, 8, 16] as const;
const WEEKDAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => i);

function cellColor(avg: number, max: number): string {
  if (max === 0 || avg === 0) return 'bg-muted/30';
  const ratio = avg / max;
  if (ratio >= 0.85) return 'bg-matcha-700 text-white';
  if (ratio >= 0.65) return 'bg-matcha-500 text-white';
  if (ratio >= 0.45) return 'bg-matcha-300 text-matcha-900';
  if (ratio >= 0.25) return 'bg-matcha-100 text-matcha-800';
  return 'bg-matcha-50 text-matcha-600';
}

export function HeatmapClient({ locationId }: { locationId: string }) {
  const [weeks, setWeeks] = useState<4 | 8 | 16>(8);
  const [data, setData] = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<{ cell: HeatmapCell; x: number; y: number } | null>(null);

  useEffect(() => {
    setLoading(true);
    setData(null);
    fetch(`/api/delivery/admin/utilization-heatmap?location_id=${locationId}&weeks=${weeks}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.cells) setData(d as HeatmapData); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId, weeks]);

  const maxAvg = data ? Math.max(...data.cells.map(c => c.avg_orders), 0.01) : 1;

  // Build lookup: weekday → hour → cell
  const cellMap = new Map<string, HeatmapCell>();
  for (const cell of (data?.cells ?? [])) {
    cellMap.set(`${cell.weekday}:${cell.hour}`, cell);
  }

  return (
    <div className="space-y-6">
      {/* Zeitraum-Auswahl */}
      <div className="flex items-center gap-2 flex-wrap">
        {WEEKS_OPTIONS.map(w => (
          <button
            key={w}
            onClick={() => setWeeks(w)}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-sm font-semibold transition',
              weeks === w
                ? 'bg-matcha-700 text-white border-matcha-700'
                : 'bg-card border-border text-muted-foreground hover:bg-muted',
            )}
          >
            {w} Wochen
          </button>
        ))}
        <span className="ml-auto text-[11px] text-muted-foreground">
          {data?.since ? `seit ${new Date(data.since).toLocaleDateString('de-DE')}` : ''}
        </span>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          Lade Heatmap-Daten…
        </div>
      )}

      {!loading && !data && (
        <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
          Keine Daten für diesen Zeitraum.
        </div>
      )}

      {!loading && data && (
        <>
          {/* Legende */}
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <BarChart3 className="h-3.5 w-3.5" />
            <span>Ø Bestellungen pro Stunde</span>
            <div className="flex items-center gap-1 ml-auto">
              <span>Wenig</span>
              {['bg-matcha-50', 'bg-matcha-100', 'bg-matcha-300', 'bg-matcha-500', 'bg-matcha-700'].map(c => (
                <div key={c} className={cn('h-3 w-5 rounded-sm border border-black/5', c)} />
              ))}
              <span>Viel</span>
            </div>
          </div>

          {/* Grid */}
          <div className="rounded-xl border bg-card overflow-x-auto">
            <div className="min-w-[640px] p-4">
              {/* Hour headers */}
              <div className="grid gap-0.5 mb-1" style={{ gridTemplateColumns: '40px repeat(24, 1fr)' }}>
                <div />
                {HOUR_LABELS.map(h => (
                  <div key={h} className="text-center text-[9px] font-bold text-muted-foreground leading-none">
                    {h % 2 === 0 ? String(h).padStart(2, '0') : ''}
                  </div>
                ))}
              </div>

              {/* Rows: weekday */}
              {WEEKDAY_LABELS.map((label, wd) => (
                <div
                  key={wd}
                  className="grid gap-0.5 mb-0.5"
                  style={{ gridTemplateColumns: '40px repeat(24, 1fr)' }}
                >
                  <div className="flex items-center text-[11px] font-semibold text-muted-foreground pr-1">
                    {label}
                  </div>
                  {HOUR_LABELS.map(h => {
                    const cell = cellMap.get(`${wd}:${h}`);
                    const avg = cell?.avg_orders ?? 0;
                    return (
                      <div
                        key={h}
                        className={cn(
                          'h-7 rounded-sm flex items-center justify-center text-[9px] font-bold cursor-default transition-opacity',
                          cellColor(avg, maxAvg),
                        )}
                        onMouseEnter={e => {
                          if (cell) {
                            const rect = (e.target as HTMLElement).getBoundingClientRect();
                            setTooltip({ cell, x: rect.left + rect.width / 2, y: rect.top });
                          }
                        }}
                        onMouseLeave={() => setTooltip(null)}
                      >
                        {avg >= 0.5 ? Math.round(avg) : ''}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Tooltip (fixed position) */}
          {tooltip && (
            <div
              className="fixed z-50 pointer-events-none -translate-x-1/2 -translate-y-full -mt-1 bg-popover border rounded-lg shadow-lg px-3 py-2 text-xs min-w-[140px]"
              style={{ left: tooltip.x, top: tooltip.y - 6 }}
            >
              <div className="font-bold mb-1">
                {WEEKDAY_LABELS[tooltip.cell.weekday]}, {String(tooltip.cell.hour).padStart(2, '0')}:00 Uhr
              </div>
              <div className="text-muted-foreground space-y-0.5">
                <div>Ø {tooltip.cell.avg_orders.toFixed(1)} Bestellungen</div>
                <div>Max {tooltip.cell.max_orders} · Gesamt {tooltip.cell.total_orders}</div>
                {tooltip.cell.weeks_with_data > 0 && (
                  <div>{tooltip.cell.weeks_with_data} Wochen mit Daten</div>
                )}
              </div>
            </div>
          )}

          {/* Summary stat */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(() => {
              const busiest = data.cells.reduce((a, b) => b.avg_orders > a.avg_orders ? b : a, data.cells[0]);
              const totalOrders = data.cells.reduce((s, c) => s + c.total_orders, 0);
              const activeCells = data.cells.filter(c => c.avg_orders > 0).length;
              const busiestLabel = busiest
                ? `${WEEKDAY_LABELS[busiest.weekday]} ${String(busiest.hour).padStart(2, '0')}:00`
                : '—';
              return (
                <>
                  <StatCard label="Bestellungen gesamt" value={String(totalOrders)} />
                  <StatCard label="Aktivste Stunde" value={busiestLabel} sub={`Ø ${busiest?.avg_orders.toFixed(1)} Bestellungen`} />
                  <StatCard label="Aktive Stunden" value={String(activeCells)} sub="von 168 möglichen" />
                  <StatCard label="Analysezeitraum" value={`${data.weeks} Wo.`} sub={`seit ${new Date(data.since).toLocaleDateString('de-DE')}`} />
                </>
              );
            })()}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{label}</div>
      <div className="font-display text-2xl font-black">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}
