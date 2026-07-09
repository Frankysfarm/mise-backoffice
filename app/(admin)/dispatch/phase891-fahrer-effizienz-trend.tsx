'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { ChevronDown, ChevronUp, Loader2, TrendingDown, TrendingUp, Minus } from 'lucide-react';

/**
 * phase891 — Fahrer-Effizienz-Trend
 *
 * 7-Tage-Trend der Stopps/h-Kennzahl je Fahrer.
 * Collapsible: Summary-Strip mit Top + Nachzügler immer sichtbar.
 * Expanded: Podium-Ranking mit Trend-Balken, Delta-%, 7d-Ø.
 * 5-Min-Polling gegen /api/delivery/admin/driver-performance?mode=trend, Fallback Mock.
 */

interface FahrerTrend {
  driver_id: string;
  name: string;
  stopps_h_heute: number;
  stopps_h_7d_avg: number;
  trend: 'up' | 'down' | 'stable';
  delta_pct: number;
  touren_heute: number;
}

interface Props {
  locationId: string | null;
}

const MOCK_FAHRER: FahrerTrend[] = [
  { driver_id: '1', name: 'Max M.',   stopps_h_heute: 4.8, stopps_h_7d_avg: 4.1, trend: 'up',     delta_pct:  17, touren_heute: 3 },
  { driver_id: '2', name: 'Anna K.',  stopps_h_heute: 3.9, stopps_h_7d_avg: 4.2, trend: 'down',   delta_pct:  -7, touren_heute: 2 },
  { driver_id: '3', name: 'Leon B.',  stopps_h_heute: 4.2, stopps_h_7d_avg: 4.2, trend: 'stable', delta_pct:   0, touren_heute: 4 },
  { driver_id: '4', name: 'Sofia R.', stopps_h_heute: 5.1, stopps_h_7d_avg: 3.8, trend: 'up',     delta_pct:  34, touren_heute: 5 },
  { driver_id: '5', name: 'Jonas W.', stopps_h_heute: 2.9, stopps_h_7d_avg: 3.5, trend: 'down',   delta_pct: -17, touren_heute: 1 },
];

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'up')   return <TrendingUp   className="h-3.5 w-3.5 text-matcha-500" />;
  if (trend === 'down') return <TrendingDown className="h-3.5 w-3.5 text-red-500"    />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

export function DispatchPhase891FahrerEffizienzTrend({ locationId }: Props) {
  const [fahrer, setFahrer] = useState<FahrerTrend[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = () => {
    if (!locationId) return;
    setLoading(true);
    fetch(`/api/delivery/admin/driver-performance?location_id=${locationId}&mode=trend`)
      .then(r => r.ok ? r.json() : null)
      .catch(() => null)
      .then(d => {
        setFahrer(d?.fahrer?.length ? (d.fahrer as FahrerTrend[]) : MOCK_FAHRER);
        setLastUpdated(new Date());
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 5 * 60_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!locationId || (!fahrer.length && !loading)) return null;

  const sorted = [...fahrer].sort((a, b) => b.stopps_h_heute - a.stopps_h_heute);
  const top  = sorted[0];
  const flop = sorted[sorted.length - 1];
  const avgH = fahrer.length
    ? fahrer.reduce((s, f) => s + f.stopps_h_heute, 0) / fahrer.length
    : 0;

  return (
    <Card className="overflow-hidden">
      {/* Header toggle */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-muted/40 transition border-b"
      >
        <TrendingUp className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
          Fahrer-Effizienz-Trend
        </span>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-1" />}
        <span className="ml-auto rounded-full bg-matcha-100 px-2 py-0.5 text-[10px] font-bold text-matcha-700">
          Ø {avgH.toFixed(1)} Stopps/h
        </span>
        {lastUpdated && (
          <span className="text-[9px] text-muted-foreground shrink-0 ml-1">
            {lastUpdated.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        {open
          ? <ChevronUp   className="h-4 w-4 text-muted-foreground ml-1 shrink-0" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground ml-1 shrink-0" />}
      </button>

      {/* Summary strip (collapsed) */}
      {!open && fahrer.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2">
          {top && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground">Top:</span>
              <span className="text-[11px] font-bold text-matcha-700">{top.name}</span>
              <span className="text-[10px] text-matcha-600">{top.stopps_h_heute.toFixed(1)}/h</span>
              <TrendIcon trend={top.trend} />
            </div>
          )}
          <div className="h-3 w-px bg-border" />
          {flop && flop.driver_id !== top?.driver_id && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground">Letzt:</span>
              <span className="text-[11px] font-bold text-red-600">{flop.name}</span>
              <span className="text-[10px] text-red-500">{flop.stopps_h_heute.toFixed(1)}/h</span>
              <TrendIcon trend={flop.trend} />
            </div>
          )}
        </div>
      )}

      {/* Expanded ranking */}
      {open && (
        <div className="divide-y">
          {sorted.map((f, i) => {
            const barW = Math.min(100, (f.stopps_h_heute / 6) * 100);
            const barColor =
              f.trend === 'up'   ? 'bg-matcha-500' :
              f.trend === 'down' ? 'bg-red-400'    : 'bg-muted-foreground/40';
            const deltaColor =
              f.trend === 'up'   ? 'text-matcha-600' :
              f.trend === 'down' ? 'text-red-500'    : 'text-muted-foreground';

            return (
              <div key={f.driver_id} className="flex items-center gap-3 px-4 py-2.5">
                <span className={cn(
                  'text-xs font-black w-5 text-center shrink-0',
                  i === 0 ? 'text-yellow-500' : i === 1 ? 'text-zinc-400' : i === 2 ? 'text-amber-700' : 'text-muted-foreground',
                )}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[11px] font-bold text-foreground truncate">{f.name}</span>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <TrendIcon trend={f.trend} />
                      <span className={cn('text-[10px] font-semibold tabular-nums', deltaColor)}>
                        {f.delta_pct > 0 ? '+' : ''}{f.delta_pct}%
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-700', barColor)}
                      style={{ width: `${barW}%` }}
                    />
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <div className="text-xs font-black text-foreground tabular-nums">
                    {f.stopps_h_heute.toFixed(1)}/h
                  </div>
                  <div className="text-[9px] text-muted-foreground tabular-nums">
                    Ø {f.stopps_h_7d_avg.toFixed(1)} · {f.touren_heute}T
                  </div>
                </div>
              </div>
            );
          })}

          <div className="px-4 py-2 flex items-center gap-4 bg-muted/20">
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-matcha-500" />
              <span className="text-[9px] text-muted-foreground">↑ vs. 7d-Ø</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-red-400" />
              <span className="text-[9px] text-muted-foreground">↓ vs. 7d-Ø</span>
            </div>
            <span className="ml-auto text-[9px] text-muted-foreground">T = Touren heute</span>
          </div>
        </div>
      )}
    </Card>
  );
}
