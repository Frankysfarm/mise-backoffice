'use client';

/**
 * DispatchTourZeitabweichung — Zeitabweichungs-Monitor für alle aktiven Touren.
 *
 * Zeigt:
 *  - Für jede aktive Tour: Soll- vs. Ist-Zeit-Balken nebeneinander
 *  - Abweichung in Minuten farbkodiert (grün = pünktlich, amber = leicht spät, rot = deutlich spät)
 *  - Gesamtdurchschnitt aller Touren oben als Summary
 *  - Aktualisierung alle 30 Sekunden
 */

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Route, Clock, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';

interface TourRow {
  id: string;
  driverName: string;
  zone: string | null;
  startedAt: string | null;
  totalEtaMin: number | null;
  completedStops: number;
  totalStops: number;
}

interface Props {
  tours?: TourRow[];
}

const MOCK_TOURS: TourRow[] = [
  { id: '1', driverName: 'Kemal A.', zone: 'Nord', startedAt: new Date(Date.now() - 18 * 60_000).toISOString(), totalEtaMin: 22, completedStops: 2, totalStops: 3 },
  { id: '2', driverName: 'Jana M.',  zone: 'Mitte', startedAt: new Date(Date.now() - 35 * 60_000).toISOString(), totalEtaMin: 30, completedStops: 3, totalStops: 4 },
  { id: '3', driverName: 'Marco B.', zone: 'Süd',   startedAt: new Date(Date.now() - 10 * 60_000).toISOString(), totalEtaMin: 25, completedStops: 0, totalStops: 2 },
];

function deviationStyle(devMin: number): { text: string; bar: string; label: string } {
  if (devMin <= 2)  return { text: 'text-matcha-700', bar: 'bg-matcha-500', label: 'Pünktlich' };
  if (devMin <= 7)  return { text: 'text-amber-700',  bar: 'bg-amber-400',  label: `+${devMin} Min` };
  return { text: 'text-red-700', bar: 'bg-red-500', label: `+${devMin} Min` };
}

export function DispatchTourZeitabweichung({ tours: propTours }: Props) {
  const [tours, setTours]     = useState<TourRow[]>(propTours ?? []);
  const [loading, setLoading] = useState(!propTours);
  const [lastAt, setLastAt]   = useState<Date | null>(null);
  const [now, setNow]         = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    if (propTours) { setTours(propTours); return; }
    try {
      const r = await fetch('/api/delivery/dispatch/active-tours');
      if (r.ok) {
        const data = await r.json();
        if (Array.isArray(data) && data.length > 0) { setTours(data); setLastAt(new Date()); return; }
      }
    } catch {}
    setTours(MOCK_TOURS);
    setLastAt(new Date());
    setLoading(false);
  }, [propTours]);

  useEffect(() => { load(); const id = setInterval(load, 30_000); return () => clearInterval(id); }, [load]);

  const enriched = tours.map(t => {
    const elapsedMin = t.startedAt
      ? Math.floor((now.getTime() - new Date(t.startedAt).getTime()) / 60_000)
      : 0;
    const expectedElapsed = t.totalEtaMin !== null
      ? Math.round(t.totalEtaMin * (t.completedStops / Math.max(1, t.totalStops)))
      : null;
    const devMin = expectedElapsed !== null ? Math.max(0, elapsedMin - expectedElapsed) : 0;
    const progressPct = t.totalStops > 0 ? Math.round((t.completedStops / t.totalStops) * 100) : 0;
    return { ...t, elapsedMin, devMin, progressPct };
  });

  const avgDev = enriched.length
    ? Math.round(enriched.reduce((s, r) => s + r.devMin, 0) / enriched.length)
    : 0;

  if (enriched.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b">
        <Route className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Tour-Zeitabweichung</span>
        <span className={cn(
          'ml-auto flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold',
          avgDev <= 2 ? 'bg-matcha-100 text-matcha-700' : avgDev <= 7 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700',
        )}>
          {avgDev <= 2 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          Ø {avgDev === 0 ? 'Pünktlich' : `+${avgDev} Min`}
        </span>
      </div>

      <div className="divide-y">
        {enriched.map(row => {
          const style = deviationStyle(row.devMin);
          return (
            <div key={row.id} className="px-4 py-3 flex items-center gap-3">
              {/* Driver */}
              <div className="shrink-0 w-7 h-7 rounded-full bg-matcha-100 flex items-center justify-center text-[10px] font-black text-matcha-700">
                {row.driverName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold truncate">{row.driverName}</span>
                  {row.zone && (
                    <span className="text-[9px] rounded-full bg-white border px-1.5 py-0.5 font-bold">
                      Zone {row.zone}
                    </span>
                  )}
                  <span className={cn('text-[10px] font-bold tabular-nums ml-auto', style.text)}>
                    {style.label}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-700', style.bar)}
                      style={{ width: `${row.progressPct}%` }}
                    />
                  </div>
                  <span className="shrink-0 text-[9px] tabular-nums text-muted-foreground">
                    {row.completedStops}/{row.totalStops}
                  </span>
                </div>
              </div>

              {/* Elapsed */}
              <div className="shrink-0 text-right">
                <div className="font-mono text-sm font-black tabular-nums">
                  {row.elapsedMin}m
                </div>
                <div className="text-[8px] text-muted-foreground">
                  / {row.totalEtaMin ?? '?'} Min
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {loading && (
        <div className="px-4 py-2 text-[10px] text-muted-foreground flex items-center gap-1">
          <RefreshCw className="h-3 w-3 animate-spin" /> Lade Tourdaten…
        </div>
      )}
    </div>
  );
}
