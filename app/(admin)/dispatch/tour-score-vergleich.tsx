'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Trophy, TrendingUp, TrendingDown, Minus, RefreshCw, Star } from 'lucide-react';

interface TourScore {
  batchId: string;
  driverName: string;
  scoreTotal: number;
  scorePunctuality: number;
  scoreEfficiency: number;
  scoreCustomer: number;
  stops: number;
  completedStops: number;
  startedAt: string | null;
  zone: string | null;
}

interface RawBatch {
  id: string;
  driver_id: string | null;
  zone: string | null;
  started_at: string | null;
  score_total?: number | null;
  score_punctuality?: number | null;
  score_efficiency?: number | null;
  score_customer?: number | null;
  delivery_batch_stops?: Array<{ status: string }>;
  delivery_driver_profiles?: { name: string } | null;
}

function ScoreBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="h-1.5 flex-1 rounded-full bg-black/10 overflow-hidden">
      <div className={cn('h-full rounded-full transition-all duration-700', color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

function ScoreRing({ value }: { value: number }) {
  const color = value >= 80 ? 'text-matcha-600' : value >= 60 ? 'text-amber-600' : 'text-red-600';
  const bg = value >= 80 ? 'bg-matcha-50' : value >= 60 ? 'bg-amber-50' : 'bg-red-50';
  return (
    <div className={cn('rounded-xl flex flex-col items-center justify-center w-12 h-12 shrink-0', bg)}>
      <span className={cn('text-lg font-black tabular-nums leading-none', color)}>{value}</span>
      <span className="text-[8px] text-stone-400 leading-none">Score</span>
    </div>
  );
}

export function DispatchTourScoreVergleich({ locationId }: { locationId: string }) {
  const [tours, setTours] = useState<TourScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshAt, setRefreshAt] = useState(Date.now());

  const loadTours = useCallback(async () => {
    try {
      const supabase = createClient();
      const since = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('delivery_batches')
        .select(`
          id, driver_id, zone, started_at,
          score_total, score_punctuality, score_efficiency, score_customer,
          delivery_batch_stops(status),
          delivery_driver_profiles(name)
        `)
        .eq('location_id', locationId)
        .in('status', ['active', 'in_progress', 'completed'])
        .gte('created_at', since)
        .order('score_total', { ascending: false })
        .limit(10);

      if (!error && Array.isArray(data)) {
        const rows: TourScore[] = (data as RawBatch[])
          .filter(b => b.score_total != null)
          .map(b => {
            const stops = b.delivery_batch_stops ?? [];
            const completed = stops.filter(s => ['delivered', 'geliefert', 'completed'].includes(s.status)).length;
            return {
              batchId: b.id,
              driverName: b.delivery_driver_profiles?.name ?? 'Fahrer',
              scoreTotal: Math.round(b.score_total!),
              scorePunctuality: Math.round(b.score_punctuality ?? 0),
              scoreEfficiency: Math.round(b.score_efficiency ?? 0),
              scoreCustomer: Math.round(b.score_customer ?? 0),
              stops: stops.length,
              completedStops: completed,
              startedAt: b.started_at,
              zone: b.zone,
            };
          });
        setTours(rows.sort((a, b) => b.scoreTotal - a.scoreTotal));
      }
    } catch {
      // keep existing
    } finally {
      setLoading(false);
      setRefreshAt(Date.now());
    }
  }, [locationId]);

  useEffect(() => {
    loadTours();
    const poll = setInterval(loadTours, 30_000);
    return () => clearInterval(poll);
  }, [loadTours]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-4 animate-pulse">
        <div className="h-4 w-44 bg-stone-100 rounded mb-3" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-stone-100 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (tours.length === 0) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-5 text-center">
        <Trophy className="h-7 w-7 text-stone-300 mx-auto mb-2" />
        <div className="text-sm text-stone-500">Keine aktiven Touren mit Score-Daten.</div>
      </div>
    );
  }

  const best = tours[0];

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-stone-100 bg-stone-50">
        <Trophy className="h-4 w-4 text-amber-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-stone-700">Tour-Score Vergleich</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] font-bold text-matcha-700 bg-matcha-50 rounded-full px-2 py-0.5">
            Beste: {best.driverName.split(' ')[0]} · {best.scoreTotal}
          </span>
          <button onClick={loadTours} className="p-1 rounded-lg hover:bg-stone-200 transition text-stone-400">
            <RefreshCw className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Tour rows */}
      <div className="divide-y divide-stone-100">
        {tours.map((t, idx) => (
          <div key={t.batchId} className="flex items-start gap-3 px-4 py-3">
            {/* Rank */}
            <div className="shrink-0 w-5 text-center mt-1">
              {idx === 0 ? (
                <Star className="h-3.5 w-3.5 text-amber-400 mx-auto" />
              ) : (
                <span className="text-[10px] font-black text-stone-400">{idx + 1}</span>
              )}
            </div>

            {/* Score ring */}
            <ScoreRing value={t.scoreTotal} />

            {/* Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-stone-800 truncate">{t.driverName}</span>
                {t.zone && (
                  <span className="text-[9px] rounded-full bg-stone-100 border border-stone-200 px-1.5 py-0.5 font-bold text-stone-500">
                    Zone {t.zone}
                  </span>
                )}
                <span className="text-[9px] text-stone-400 ml-auto tabular-nums">
                  {t.completedStops}/{t.stops} Stops
                </span>
              </div>

              {/* Sub-scores */}
              <div className="mt-2 space-y-1">
                {[
                  { label: 'Pünktlichkeit', val: t.scorePunctuality, color: 'bg-matcha-500' },
                  { label: 'Effizienz',     val: t.scoreEfficiency,  color: 'bg-blue-500'   },
                  { label: 'Kundenwert',    val: t.scoreCustomer,    color: 'bg-amber-400'  },
                ].map(row => (
                  <div key={row.label} className="flex items-center gap-2">
                    <span className="text-[9px] text-stone-400 w-20 shrink-0">{row.label}</span>
                    <ScoreBar value={row.val} color={row.color} />
                    <span className="text-[9px] font-bold text-stone-600 tabular-nums w-6 text-right">{row.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-stone-100 bg-stone-50">
        <span className="text-[10px] text-stone-400">
          {tours.length} Tour{tours.length !== 1 ? 'en' : ''} · aktualisiert {new Date(refreshAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}
