'use client';

import { useEffect, useState } from 'react';
import { Zap, TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props { locationId: string | null }

interface StatsResp {
  orders_per_hour?: number;
  avg_delivery_min?: number;
  on_time_rate?: number;
  active_drivers?: number;
}

export function LieferdienstSchichtTempoKpi({ locationId }: Props) {
  const [data, setData] = useState<StatsResp | null>(null);
  const [prev, setPrev] = useState<StatsResp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;

    const load = async () => {
      try {
        const r = await fetch(`/api/delivery/admin/stats?period=today&location_id=${encodeURIComponent(locationId)}`);
        if (!r.ok) throw new Error('fail');
        const d: StatsResp = await r.json();
        if (!cancelled) {
          setPrev(prev => prev ?? d);
          setData(old => { setPrev(old); return d; });
        }
      } catch {}
      finally { if (!cancelled) setLoading(false); }
    };

    load();
    const iv = setInterval(load, 2 * 60_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  if (!locationId) return null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-stone-200 bg-white p-5 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Lade Schicht-Tempo…
      </div>
    );
  }

  if (!data) return null;

  const oph    = data.orders_per_hour ?? 0;
  const avgMin = data.avg_delivery_min ?? 0;
  const onTime = data.on_time_rate ?? 0;
  const active = data.active_drivers ?? 0;

  const prevOph = prev?.orders_per_hour ?? oph;
  const trend = oph > prevOph + 0.5 ? 'up' : oph < prevOph - 0.5 ? 'down' : 'flat';

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-matcha-600' : trend === 'down' ? 'text-red-500' : 'text-stone-400';

  const onTimePct = Math.round(onTime * 100);
  const onTimeColor = onTimePct >= 80 ? 'text-matcha-700' : onTimePct >= 60 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <div className="flex items-center gap-3 border-b border-stone-100 px-5 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-matcha-100 text-matcha-700">
          <Zap className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-bold text-char">Schicht-Tempo Live</div>
          <div className="text-xs text-stone-400">Bestellrate · Lieferzeit · Pünktlichkeit</div>
        </div>
        <div className={cn('ml-auto flex items-center gap-1 text-xs font-bold', trendColor)}>
          <TrendIcon className="h-3.5 w-3.5" />
          {trend === 'up' ? 'Steigend' : trend === 'down' ? 'Fallend' : 'Stabil'}
        </div>
      </div>

      <div className="grid grid-cols-2 divide-x divide-stone-100">
        <div className="px-5 py-4 text-center">
          <div className="text-2xl font-black tabular-nums text-matcha-700">
            {oph.toFixed(1)}
          </div>
          <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-stone-400">
            Bestellungen/h
          </div>
        </div>
        <div className="px-5 py-4 text-center">
          <div className={cn('text-2xl font-black tabular-nums', avgMin > 45 ? 'text-red-600' : avgMin > 35 ? 'text-amber-600' : 'text-matcha-700')}>
            {Math.round(avgMin)}&apos;
          </div>
          <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-stone-400">
            Ø Lieferzeit
          </div>
        </div>
      </div>

      <div className="border-t border-stone-100 flex items-center justify-between px-5 py-3">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-stone-500">Pünktlichkeit</span>
          <span className={cn('text-sm font-black tabular-nums', onTimeColor)}>
            {onTimePct}%
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-stone-500">Aktive Fahrer</span>
          <span className="text-sm font-black tabular-nums text-stone-700">{active}</span>
        </div>
      </div>
    </div>
  );
}
