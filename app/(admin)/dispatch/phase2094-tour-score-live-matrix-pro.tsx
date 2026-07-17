'use client';

import { useCallback, useEffect, useState } from 'react';
import { Trophy, Clock, MapPin, Truck, ChevronDown, ChevronUp, Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TourScore {
  batch_id: string;
  driver_name: string;
  vehicle: 'bike' | 'car';
  score: number;
  score_trend: 'up' | 'down' | 'stable';
  stops_total: number;
  stops_done: number;
  on_time_pct: number;
  eta_remaining_min: number | null;
  distance_km: number;
  status: 'pickup' | 'on_route' | 'returning';
  zone: string;
  dimensions: {
    punctuality: number;
    efficiency: number;
    rating: number;
    reliability: number;
  };
}

interface ApiData {
  tours: TourScore[];
  team_avg_score: number;
  active_count: number;
}

const MOCK: ApiData = {
  team_avg_score: 78,
  active_count: 3,
  tours: [
    {
      batch_id: 'b1', driver_name: 'Tom H.', vehicle: 'bike', score: 88,
      score_trend: 'up', stops_total: 4, stops_done: 2, on_time_pct: 100,
      eta_remaining_min: 18, distance_km: 4.2, status: 'on_route', zone: 'A',
      dimensions: { punctuality: 92, efficiency: 85, rating: 90, reliability: 80 },
    },
    {
      batch_id: 'b2', driver_name: 'Jana R.', vehicle: 'car', score: 71,
      score_trend: 'stable', stops_total: 3, stops_done: 1, on_time_pct: 67,
      eta_remaining_min: 25, distance_km: 6.1, status: 'on_route', zone: 'B',
      dimensions: { punctuality: 65, efficiency: 75, rating: 80, reliability: 72 },
    },
    {
      batch_id: 'b3', driver_name: 'Kai M.', vehicle: 'bike', score: 62,
      score_trend: 'down', stops_total: 2, stops_done: 0, on_time_pct: 50,
      eta_remaining_min: 32, distance_km: 3.8, status: 'pickup', zone: 'C',
      dimensions: { punctuality: 55, efficiency: 68, rating: 72, reliability: 60 },
    },
  ],
};

interface Props {
  batches?: any[];
  drivers?: any[];
  locationId?: string | null;
}

function scoreColor(s: number) {
  if (s >= 85) return 'text-matcha-700';
  if (s >= 70) return 'text-amber-700';
  return 'text-red-600';
}

function scoreBg(s: number) {
  if (s >= 85) return 'bg-matcha-50 border-matcha-200';
  if (s >= 70) return 'bg-amber-50 border-amber-200';
  return 'bg-red-50 border-red-200';
}

function dimBar(val: number) {
  const col = val >= 80 ? 'bg-matcha-400' : val >= 65 ? 'bg-amber-400' : 'bg-red-400';
  return { col, pct: val };
}

export function DispatchPhase2094TourScoreLiveMatrixPro({ locationId }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/dispatch/tour-score-matrix?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) setData(await r.json());
    } catch {}
    finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const t = setInterval(load, 30_000); return () => clearInterval(t); }, [load]);

  const avgCol = data.team_avg_score >= 80 ? 'text-matcha-600' : data.team_avg_score >= 65 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 border-b hover:bg-muted/30 transition-colors"
      >
        <Trophy className="h-4 w-4 shrink-0 text-saffron" />
        <span className="text-xs font-bold uppercase tracking-wider">Tour-Score · Live-Matrix</span>
        <span className={cn('ml-1 text-xs font-black tabular-nums', avgCol)}>Ø {data.team_avg_score}</span>
        <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
          {data.active_count} aktiv
        </span>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-1" />}
        <span className="ml-auto">
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </span>
      </button>

      {open && (
        <div className="p-3 space-y-2">
          {data.tours.map((t, i) => {
            const isExp = expanded === t.batch_id;
            const stopPct = t.stops_total > 0 ? (t.stops_done / t.stops_total) * 100 : 0;
            return (
              <div key={t.batch_id} className={cn('rounded-xl border overflow-hidden', scoreBg(t.score))}>
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-black/5 transition-colors"
                  onClick={() => setExpanded(isExp ? null : t.batch_id)}
                >
                  {/* Rank */}
                  <span className="text-[10px] font-black tabular-nums text-muted-foreground w-4 shrink-0">{i + 1}</span>

                  {/* Vehicle */}
                  <Truck className={cn('h-3.5 w-3.5 shrink-0', t.vehicle === 'bike' ? 'text-matcha-600' : 'text-blue-600')} />

                  {/* Name + zone */}
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold truncate">{t.driver_name}</span>
                      <span className="text-[9px] bg-black/10 rounded px-1 text-muted-foreground">{t.zone}</span>
                      {t.score_trend === 'up' && <TrendingUp className="h-3 w-3 text-matcha-600" />}
                      {t.score_trend === 'down' && <TrendingDown className="h-3 w-3 text-red-500" />}
                    </div>
                    {/* Stop progress bar */}
                    <div className="mt-1 flex items-center gap-1.5">
                      <div className="flex-1 h-1 rounded-full bg-black/10 overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all', t.on_time_pct >= 80 ? 'bg-matcha-400' : t.on_time_pct >= 60 ? 'bg-amber-400' : 'bg-red-400')}
                          style={{ width: `${stopPct}%` }}
                        />
                      </div>
                      <span className="text-[9px] tabular-nums text-muted-foreground shrink-0">
                        {t.stops_done}/{t.stops_total}
                      </span>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-3 shrink-0">
                    {t.eta_remaining_min !== null && (
                      <div className="text-right">
                        <div className="text-[10px] font-mono tabular-nums font-bold text-foreground">{t.eta_remaining_min}m</div>
                        <div className="text-[8px] text-muted-foreground">verbl.</div>
                      </div>
                    )}
                    <div className="text-right">
                      <div className={cn('text-base font-black tabular-nums leading-tight', scoreColor(t.score))}>{t.score}</div>
                      <div className="text-[8px] text-muted-foreground">Score</div>
                    </div>
                    <span className="text-[9px] text-muted-foreground">{isExp ? '▲' : '▼'}</span>
                  </div>
                </button>

                {/* Expanded: dimension bars */}
                {isExp && (
                  <div className="px-3 pb-3 pt-1 border-t border-black/10 space-y-1.5">
                    {([
                      ['Pünktlichkeit', t.dimensions.punctuality],
                      ['Effizienz', t.dimensions.efficiency],
                      ['Bewertung', t.dimensions.rating],
                      ['Zuverlässigkeit', t.dimensions.reliability],
                    ] as [string, number][]).map(([label, val]) => {
                      const b = dimBar(val);
                      return (
                        <div key={label} className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground w-24 shrink-0">{label}</span>
                          <div className="flex-1 h-1.5 rounded-full bg-black/10 overflow-hidden">
                            <div className={cn('h-full rounded-full', b.col)} style={{ width: `${b.pct}%` }} />
                          </div>
                          <span className="text-[10px] tabular-nums font-bold text-foreground w-6 text-right shrink-0">{val}</span>
                        </div>
                      );
                    })}
                    <div className="flex items-center gap-3 pt-1 text-[10px] text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      <span className="tabular-nums">{t.distance_km.toFixed(1)} km</span>
                      <Clock className="h-3 w-3 ml-2" />
                      <span className="tabular-nums">{t.on_time_pct}% pünktlich</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {data.tours.length === 0 && (
            <div className="text-[11px] text-muted-foreground text-center py-3">Keine aktiven Touren</div>
          )}

          <div className="text-[9px] text-muted-foreground text-right pt-1">30s-Update · Tippen für Details</div>
        </div>
      )}
    </div>
  );
}
