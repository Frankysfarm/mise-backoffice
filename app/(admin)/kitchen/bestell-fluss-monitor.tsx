'use client';

/**
 * KitchenBestellFlussMonitor — Phase 337
 *
 * Echtzeit-Durchsatz-Anzeige für die Küche.
 * Pollt /api/delivery/admin/overview alle 60s.
 * Zeigt: Bestellungen in der letzten Stunde, Ø-Wartezeit, aktive Batches, Stornierungsrate.
 * Farbkodierung: grün (wachsend), amber (stabil), rot (fallend).
 */

import { useEffect, useRef, useState } from 'react';
import { Activity, Clock, Package, TrendingDown, TrendingUp, Minus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OverviewData {
  ordersLastHour: number;
  avgWaitMin: number;
  activeBatches: number;
  cancellationRate: number;
}

const MOCK: OverviewData = {
  ordersLastHour: 12,
  avgWaitMin: 18,
  activeBatches: 3,
  cancellationRate: 2.1,
};

type Trend = 'up' | 'flat' | 'down';

export default function KitchenBestellFlussMonitor() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [prev, setPrev] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function fetchData() {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    try {
      const res = await fetch('/api/delivery/admin/overview', {
        signal: abortRef.current.signal,
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('not ok');
      const json = (await res.json()) as OverviewData;
      setPrev(d => d);
      setData(json);
      setError(false);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setError(true);
        if (!data) setData(MOCK);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 60_000);
    return () => {
      clearInterval(iv);
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayed = data ?? MOCK;

  const trend: Trend =
    prev == null
      ? 'flat'
      : displayed.ordersLastHour > prev.ordersLastHour
      ? 'up'
      : displayed.ordersLastHour < prev.ordersLastHour
      ? 'down'
      : 'flat';

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor =
    trend === 'up'
      ? 'text-emerald-600'
      : trend === 'down'
      ? 'text-red-500'
      : 'text-amber-500';
  const stripBg =
    trend === 'up'
      ? 'bg-emerald-50 border-emerald-200'
      : trend === 'down'
      ? 'bg-red-50 border-red-200'
      : 'bg-amber-50 border-amber-200';

  return (
    <div className={cn('rounded-xl border px-4 py-2.5 flex items-center gap-4 flex-wrap', stripBg)}>
      {/* Header */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Activity className={cn('h-4 w-4 shrink-0', trendColor)} />
        <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">
          Bestellfluss
        </span>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        {error && !loading && (
          <span className="text-[9px] text-amber-600 font-bold">Offline · Mockdaten</span>
        )}
      </div>

      {/* KPI 1: Bestellungen letzte Stunde */}
      <div className="flex items-center gap-1.5 shrink-0">
        <TrendIcon className={cn('h-3.5 w-3.5 shrink-0', trendColor)} />
        <div>
          <span className={cn('font-mono text-base font-black tabular-nums leading-none', trendColor)}>
            {displayed.ordersLastHour}
          </span>
          <span className="ml-1 text-[10px] text-muted-foreground">Bestellungen/Std</span>
        </div>
      </div>

      {/* Divider */}
      <span className="h-4 w-px bg-border shrink-0 hidden sm:block" />

      {/* KPI 2: Ø Wartezeit */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <div>
          <span className={cn(
            'font-mono text-base font-black tabular-nums leading-none',
            displayed.avgWaitMin <= 20 ? 'text-emerald-600' : displayed.avgWaitMin <= 35 ? 'text-amber-600' : 'text-red-600',
          )}>
            {displayed.avgWaitMin}
          </span>
          <span className="ml-1 text-[10px] text-muted-foreground">Min Ø Wartezeit</span>
        </div>
      </div>

      {/* Divider */}
      <span className="h-4 w-px bg-border shrink-0 hidden sm:block" />

      {/* KPI 3: Aktive Batches */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <div>
          <span className="font-mono text-base font-black tabular-nums leading-none text-foreground">
            {displayed.activeBatches}
          </span>
          <span className="ml-1 text-[10px] text-muted-foreground">aktive Batches</span>
        </div>
      </div>

      {/* Divider */}
      <span className="h-4 w-px bg-border shrink-0 hidden sm:block" />

      {/* KPI 4: Stornierungsrate */}
      <div className="flex items-center gap-1.5 shrink-0 ml-auto">
        <div>
          <span className={cn(
            'font-mono text-base font-black tabular-nums leading-none',
            displayed.cancellationRate < 3 ? 'text-emerald-600' : displayed.cancellationRate < 6 ? 'text-amber-600' : 'text-red-600',
          )}>
            {displayed.cancellationRate.toFixed(1)}%
          </span>
          <span className="ml-1 text-[10px] text-muted-foreground">Stornoquote</span>
        </div>
      </div>
    </div>
  );
}
