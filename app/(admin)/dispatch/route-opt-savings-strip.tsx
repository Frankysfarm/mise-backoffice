'use client';

import { useCallback, useEffect, useState } from 'react';
import { Route, Zap, TrendingDown, RefreshCw, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OptStats {
  total_optimizations: number;
  avg_improvement_pct: number;
  total_km_saved: number;
  google_tsp_count: number;
  two_opt_count: number;
  last_run_at: string | null;
}

interface PendingBatch {
  id: string;
  state: string;
  stop_count: number;
}

interface Props {
  locationId: string | null;
}

export function DispatchRouteOptSavingsStrip({ locationId }: Props) {
  const [stats, setStats] = useState<OptStats | null>(null);
  const [pending, setPending] = useState<PendingBatch[]>([]);
  const [optimizing, setOptimizing] = useState(false);
  const [lastResult, setLastResult] = useState<{ optimized: number; kmSaved: number } | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/route-optimization?location_id=${locationId}`);
      if (!res.ok) return;
      const d = await res.json();
      if (d?.stats) setStats(d.stats);
      if (Array.isArray(d?.pendingBatches)) setPending(d.pendingBatches);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 120_000);
    return () => clearInterval(iv);
  }, [load]);

  async function optimizeAll() {
    setOptimizing(true);
    try {
      const res = await fetch('/api/delivery/admin/route-optimization', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'optimize_all' }),
      });
      if (res.ok) {
        const d = await res.json();
        setLastResult({ optimized: d.optimized ?? 0, kmSaved: d.totalKmSaved ?? 0 });
        await load();
      }
    } catch { /* silent */ } finally {
      setOptimizing(false);
    }
  }

  if (!locationId) return null;
  if (!stats && !loading && pending.length === 0) return null;

  const hasData = stats != null && stats.total_optimizations > 0;
  const hasPending = pending.length > 0;
  const algoLabel = stats
    ? stats.google_tsp_count > (stats.two_opt_count ?? 0)
      ? 'Google TSP'
      : '2-opt'
    : '–';

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
        <Route size={13} className="text-muted-foreground shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex-1">
          Routen-Optimierung
        </span>
        {hasPending && (
          <button
            onClick={optimizeAll}
            disabled={optimizing}
            className={cn(
              'flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold transition-colors',
              optimizing
                ? 'bg-muted text-muted-foreground'
                : 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95',
            )}
          >
            {optimizing
              ? <RefreshCw size={10} className="animate-spin" />
              : <Play size={10} />}
            {optimizing ? 'Läuft…' : `${pending.length} optimieren`}
          </button>
        )}
        {loading && <RefreshCw size={11} className="text-muted-foreground animate-spin" />}
      </div>

      {/* Stats row */}
      {hasData && (
        <div className="grid grid-cols-3 divide-x divide-border">
          <div className="flex flex-col items-center justify-center py-2.5 px-2">
            <TrendingDown size={13} className="text-emerald-500 mb-0.5" />
            <span className="text-base font-black tabular-nums text-emerald-600">
              {stats!.total_km_saved.toFixed(1)}
            </span>
            <span className="text-[9px] text-muted-foreground uppercase tracking-wide">km gespart</span>
          </div>
          <div className="flex flex-col items-center justify-center py-2.5 px-2">
            <Zap size={13} className="text-blue-500 mb-0.5" />
            <span className="text-base font-black tabular-nums text-blue-600">
              {stats!.avg_improvement_pct.toFixed(1)}%
            </span>
            <span className="text-[9px] text-muted-foreground uppercase tracking-wide">Ø Einsparung</span>
          </div>
          <div className="flex flex-col items-center justify-center py-2.5 px-2">
            <Route size={13} className="text-purple-500 mb-0.5" />
            <span className="text-base font-black tabular-nums text-purple-600">
              {stats!.total_optimizations}
            </span>
            <span className="text-[9px] text-muted-foreground uppercase tracking-wide">
              {algoLabel}
            </span>
          </div>
        </div>
      )}

      {/* Pending batches notice */}
      {hasPending && !hasData && (
        <div className="px-3 py-2.5 flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {pending.length} {pending.length === 1 ? 'Tour' : 'Touren'} noch nicht optimiert
          </span>
        </div>
      )}

      {/* Success flash */}
      {lastResult && lastResult.optimized > 0 && (
        <div className="px-3 py-2 bg-emerald-50 border-t border-emerald-100 flex items-center gap-2">
          <Zap size={12} className="text-emerald-600 shrink-0" />
          <span className="text-xs font-semibold text-emerald-700">
            {lastResult.optimized} Tour{lastResult.optimized !== 1 ? 'en' : ''} optimiert ·{' '}
            {lastResult.kmSaved.toFixed(1)} km gespart
          </span>
        </div>
      )}
    </div>
  );
}
