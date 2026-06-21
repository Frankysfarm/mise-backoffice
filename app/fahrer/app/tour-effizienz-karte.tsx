'use client';

/**
 * FahrerTourEffizienzKarte — Phase 362
 *
 * Persönliche EUR/Stopp-Effizienzkarte für Fahrer.
 * Vergleicht eigene Leistung mit dem P75-Benchmark der Filiale.
 * Pollt /api/delivery/admin/tour-efficiency-report alle 5 Minuten.
 */

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, Euro, ChevronDown, ChevronUp } from 'lucide-react';

type DriverBenchmark = {
  driverId:       string;
  driverName:     string;
  stopsCompleted: number;
  revenueEur:     number;
  revPerStopEur:  number | null;
  benchmarkGrade: string;
};

type Dashboard = {
  driverBenchmarks: DriverBenchmark[];
  p75Benchmark:     number | null;
};

type Props = {
  driverId?: string | null;
  locationId?: string | null;
};

export function FahrerTourEffizienzKarte({ driverId, locationId }: Props) {
  const [data, setData]         = useState<Dashboard | null>(null);
  const [open, setOpen]         = useState(false);
  const [loading, setLoading]   = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const params = new URLSearchParams();
        if (locationId) params.set('location_id', locationId);
        params.set('days', '7');
        const res = await fetch(`/api/delivery/admin/tour-efficiency-report?${params}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('non-ok');
        const json: Dashboard = await res.json();
        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    intervalRef.current = setInterval(load, 5 * 60_000);
    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [driverId, locationId]);

  if (loading) {
    return (
      <div className="rounded-2xl bg-stone-800 border border-stone-700 px-4 py-3 animate-pulse">
        <div className="h-4 w-32 bg-stone-700 rounded mb-2" />
        <div className="h-8 w-20 bg-stone-700 rounded" />
      </div>
    );
  }

  if (!data) return null;

  const myEntry = driverId
    ? data.driverBenchmarks.find((d) => d.driverId === driverId)
    : data.driverBenchmarks[0];

  const myRps   = myEntry?.revPerStopEur ?? null;
  const p75     = data.p75Benchmark;
  const grade   = myEntry?.benchmarkGrade ?? null;

  const gradeColor =
    grade === 'A+' ? 'text-emerald-400'
    : grade === 'A' ? 'text-green-400'
    : grade === 'B' ? 'text-amber-400'
    : grade === 'C' ? 'text-orange-400'
    : 'text-red-400';

  const vsPct = myRps && p75
    ? Math.round(((myRps - p75) / p75) * 100)
    : null;

  const TrendIcon = vsPct == null ? Minus
    : vsPct > 5  ? TrendingUp
    : vsPct < -5 ? TrendingDown
    : Minus;

  const trendColor = vsPct == null ? 'text-stone-400'
    : vsPct > 5  ? 'text-emerald-400'
    : vsPct < -5 ? 'text-red-400'
    : 'text-amber-400';

  return (
    <div className="rounded-2xl bg-stone-900 border border-stone-700 px-4 py-3 text-white">
      <button
        className="w-full flex items-center justify-between"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-2">
          <Euro className="h-4 w-4 text-matcha-400" />
          <span className="text-sm font-bold text-stone-200">Meine Tour-Effizienz</span>
        </div>
        <div className="flex items-center gap-2">
          {grade && (
            <span className={cn('text-sm font-black', gradeColor)}>
              {grade}
            </span>
          )}
          {open ? <ChevronUp className="h-4 w-4 text-stone-400" /> : <ChevronDown className="h-4 w-4 text-stone-400" />}
        </div>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-stone-800 px-3 py-2 text-center">
              <div className="text-xs text-stone-400 mb-0.5">Mein EUR/Stopp</div>
              <div className="text-lg font-black text-white tabular-nums">
                {myRps != null ? `${myRps.toFixed(2)}€` : '–'}
              </div>
            </div>
            <div className="rounded-xl bg-stone-800 px-3 py-2 text-center">
              <div className="text-xs text-stone-400 mb-0.5">P75-Bench</div>
              <div className="text-lg font-black text-stone-300 tabular-nums">
                {p75 != null ? `${p75.toFixed(2)}€` : '–'}
              </div>
            </div>
            <div className="rounded-xl bg-stone-800 px-3 py-2 text-center">
              <div className="text-xs text-stone-400 mb-0.5">vs. Bench</div>
              <div className={cn('flex items-center justify-center gap-1 text-lg font-black tabular-nums', trendColor)}>
                <TrendIcon className="h-4 w-4" />
                {vsPct != null ? `${vsPct > 0 ? '+' : ''}${vsPct}%` : '–'}
              </div>
            </div>
          </div>

          {myEntry && (
            <div className="text-xs text-stone-400 text-center">
              {myEntry.stopsCompleted} Stops · {myEntry.revenueEur.toFixed(2)}€ (7 Tage)
            </div>
          )}

          {vsPct != null && vsPct > 10 && (
            <div className="rounded-xl bg-emerald-900/40 border border-emerald-700/50 px-3 py-2 text-xs text-emerald-300 font-semibold text-center">
              Top-Performance! Du bist {vsPct}% über dem Filial-Benchmark 🏆
            </div>
          )}
          {vsPct != null && vsPct < -15 && (
            <div className="rounded-xl bg-amber-900/40 border border-amber-700/50 px-3 py-2 text-xs text-amber-300 font-semibold text-center">
              Effizienz-Tipp: Mehr Bundling-Touren nehmen steigert den EUR/Stopp
            </div>
          )}
        </div>
      )}
    </div>
  );
}
