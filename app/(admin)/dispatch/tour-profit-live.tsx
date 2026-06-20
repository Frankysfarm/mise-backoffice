'use client';

/**
 * DispatchTourProfitLive — Phase 337
 *
 * Live Touren-Deckungsbeitrag für den Dispatcher.
 * Pollt /api/delivery/admin/tour-profit alle 90s.
 * Zeigt: EUR/Stopp, EUR/km, Deckungsbeitrag heute, vs. gestern Δ.
 * Farb-Grade: A (≥€4/Stop) grün, B (≥€3) amber, C (<€3) rot.
 * Top-3-Touren nach Profit.
 */

import { useEffect, useRef, useState } from 'react';
import { Euro, TrendingUp, TrendingDown, Loader2, Route } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TourProfitEntry {
  tourId: string;
  driverName: string;
  eurPerStop: number;
  eurPerKm: number;
  profit: number;
}

interface TourProfitData {
  eurPerStop: number;
  eurPerKm: number;
  todayProfit: number;
  deltaPercent: number;
  topTours?: TourProfitEntry[];
}

const MOCK: TourProfitData = {
  eurPerStop: 3.80,
  eurPerKm: 1.20,
  todayProfit: 284,
  deltaPercent: 5.2,
  topTours: [
    { tourId: 't1', driverName: 'Ali K.',    eurPerStop: 4.50, eurPerKm: 1.40, profit: 112 },
    { tourId: 't2', driverName: 'Bernd M.',  eurPerStop: 3.90, eurPerKm: 1.25, profit: 98  },
    { tourId: 't3', driverName: 'Canan Y.',  eurPerStop: 3.20, eurPerKm: 1.10, profit: 74  },
  ],
};

type Grade = 'A' | 'B' | 'C';

function getGrade(eurPerStop: number): Grade {
  if (eurPerStop >= 4) return 'A';
  if (eurPerStop >= 3) return 'B';
  return 'C';
}

const GRADE_STYLES: Record<Grade, { badge: string; text: string }> = {
  A: { badge: 'bg-emerald-100 text-emerald-800 border-emerald-300', text: 'text-emerald-700' },
  B: { badge: 'bg-amber-100  text-amber-800  border-amber-300',  text: 'text-amber-700'  },
  C: { badge: 'bg-red-100    text-red-800    border-red-300',    text: 'text-red-700'    },
};

function fmt2(n: number) {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function DispatchTourProfitLive() {
  const [data, setData] = useState<TourProfitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [useMock, setUseMock] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function fetchData() {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    try {
      const res = await fetch('/api/delivery/admin/tour-profit', {
        signal: abortRef.current.signal,
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('not ok');
      const json = (await res.json()) as TourProfitData;
      setData(json);
      setUseMock(false);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setUseMock(true);
        if (!data) setData(MOCK);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 90_000);
    return () => {
      clearInterval(iv);
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const d = data ?? MOCK;
  const overallGrade = getGrade(d.eurPerStop);
  const overallStyle = GRADE_STYLES[overallGrade];
  const topTours = d.topTours ?? MOCK.topTours ?? [];

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/30">
        <Euro className="h-4 w-4 text-emerald-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Tour-Deckungsbeitrag · Live</span>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-auto" />}
        {useMock && !loading && (
          <span className="ml-auto text-[9px] text-amber-600 font-bold">Mockdaten</span>
        )}
        {!loading && !useMock && (
          <span className={cn(
            'ml-auto inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-black',
            overallStyle.badge,
          )}>
            Grade {overallGrade}
          </span>
        )}
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-4 divide-x border-b">
        {/* EUR/Stop */}
        <div className="px-3 py-2.5 text-center">
          <div className={cn('font-mono text-sm font-black tabular-nums', overallStyle.text)}>
            €{fmt2(d.eurPerStop)}
          </div>
          <div className="text-[9px] text-muted-foreground mt-0.5">pro Stopp</div>
        </div>

        {/* EUR/km */}
        <div className="px-3 py-2.5 text-center">
          <div className="font-mono text-sm font-black tabular-nums text-foreground">
            €{fmt2(d.eurPerKm)}
          </div>
          <div className="text-[9px] text-muted-foreground mt-0.5">pro km</div>
        </div>

        {/* Heute gesamt */}
        <div className="px-3 py-2.5 text-center">
          <div className="font-mono text-sm font-black tabular-nums text-emerald-700">
            €{d.todayProfit.toLocaleString('de-DE')}
          </div>
          <div className="text-[9px] text-muted-foreground mt-0.5">Heute DB</div>
        </div>

        {/* Δ vs gestern */}
        <div className="px-3 py-2.5 text-center">
          <div className={cn(
            'flex items-center justify-center gap-0.5 font-mono text-sm font-black tabular-nums',
            d.deltaPercent >= 0 ? 'text-emerald-600' : 'text-red-600',
          )}>
            {d.deltaPercent >= 0
              ? <TrendingUp className="h-3.5 w-3.5 shrink-0" />
              : <TrendingDown className="h-3.5 w-3.5 shrink-0" />}
            {d.deltaPercent >= 0 ? '+' : ''}{d.deltaPercent.toFixed(1)}%
          </div>
          <div className="text-[9px] text-muted-foreground mt-0.5">vs. gestern</div>
        </div>
      </div>

      {/* Top-3 Touren */}
      {topTours.length > 0 && (
        <div className="divide-y">
          <div className="px-4 py-1.5 bg-muted/20">
            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
              Top-3 Touren nach Deckungsbeitrag
            </span>
          </div>
          {topTours.slice(0, 3).map((tour, idx) => {
            const grade = getGrade(tour.eurPerStop);
            const style = GRADE_STYLES[grade];
            return (
              <div key={tour.tourId} className="flex items-center gap-3 px-4 py-2">
                <span className="text-[10px] font-black text-muted-foreground w-4 shrink-0">
                  {idx + 1}
                </span>
                <Route className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="flex-1 text-[11px] font-bold truncate">{tour.driverName}</span>
                <span className={cn(
                  'rounded-full border px-1.5 py-0.5 text-[9px] font-black shrink-0',
                  style.badge,
                )}>
                  {grade}
                </span>
                <span className={cn('text-[11px] font-bold tabular-nums shrink-0', style.text)}>
                  €{fmt2(tour.eurPerStop)}/Stopp
                </span>
                <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                  €{tour.profit.toLocaleString('de-DE')}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
