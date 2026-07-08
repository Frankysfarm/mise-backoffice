'use client';

import { useEffect, useState, useMemo } from 'react';
import { Clock, Zap, TrendingUp, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Order {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
}

interface KitchenTiming {
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
  status: string;
}

interface Props {
  orders: Order[];
  timings: KitchenTiming[];
}

interface TimingEntry {
  orderId: string;
  bestellnummer: string;
  prepMin: number;
  elapsedMin: number;
  remainMin: number;
  pct: number;
  status: 'on-track' | 'warning' | 'late';
}

export function KitchenPhase826SmartTimingCockpitLive({ orders, timings }: Props) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 5000);
    return () => clearInterval(iv);
  }, []);

  const entries = useMemo<TimingEntry[]>(() => {
    const now = Date.now();
    const active = orders.filter((o) =>
      ['bestätigt', 'in_zubereitung', 'neu'].includes(o.status)
    );
    return active.map((o) => {
      const t = timings.find((t) => t.order_id === o.id);
      const prepMin = t?.prep_min ?? o.geschaetzte_zubereitung_min ?? 15;
      const startMs = t?.cook_start_at
        ? new Date(t.cook_start_at).getTime()
        : o.bestellt_am
        ? new Date(o.bestellt_am).getTime()
        : now;
      const elapsedMin = Math.max(0, (now - startMs) / 60000);
      const remainMin = Math.max(0, prepMin - elapsedMin);
      const pct = Math.min(100, (elapsedMin / Math.max(1, prepMin)) * 100);
      const status: TimingEntry['status'] =
        pct >= 110 ? 'late' : pct >= 85 ? 'warning' : 'on-track';
      return {
        orderId: o.id,
        bestellnummer: o.bestellnummer,
        prepMin,
        elapsedMin,
        remainMin,
        pct,
        status,
      };
    }).sort((a, b) => b.pct - a.pct).slice(0, 6);
  }, [orders, timings, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const lateCount = entries.filter((e) => e.status === 'late').length;
  const warnCount = entries.filter((e) => e.status === 'warning').length;

  if (entries.length === 0) return null;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <div className={cn(
        'flex items-center gap-2 px-4 py-3 border-b',
        lateCount > 0 ? 'bg-red-50 border-red-100' : warnCount > 0 ? 'bg-amber-50 border-amber-100' : 'bg-matcha-50 border-matcha-100'
      )}>
        <Clock className={cn('h-4 w-4', lateCount > 0 ? 'text-red-600' : warnCount > 0 ? 'text-amber-600' : 'text-matcha-700')} />
        <span className={cn('text-sm font-bold', lateCount > 0 ? 'text-red-800' : warnCount > 0 ? 'text-amber-800' : 'text-matcha-800')}>
          Smart-Timing Live
        </span>
        <div className="ml-auto flex items-center gap-2">
          {lateCount > 0 && (
            <span className="text-[10px] bg-red-500 text-white rounded-full px-2 py-0.5 font-bold animate-pulse">
              {lateCount} überzogen
            </span>
          )}
          {warnCount > 0 && (
            <span className="text-[10px] bg-amber-400 text-white rounded-full px-2 py-0.5 font-bold">
              {warnCount} kritisch
            </span>
          )}
        </div>
      </div>

      <div className="divide-y divide-stone-50">
        {entries.map((e) => {
          const barColor =
            e.status === 'late' ? 'bg-red-500' :
            e.status === 'warning' ? 'bg-amber-400' : 'bg-matcha-500';
          const textColor =
            e.status === 'late' ? 'text-red-700' :
            e.status === 'warning' ? 'text-amber-700' : 'text-matcha-700';
          const Icon =
            e.status === 'late' ? Zap : e.status === 'warning' ? TrendingUp : CheckCircle2;
          return (
            <div key={e.orderId} className="px-4 py-2.5 flex items-center gap-3">
              <Icon className={cn('h-4 w-4 shrink-0', textColor, e.status === 'late' && 'animate-pulse')} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold truncate">#{e.bestellnummer}</span>
                  <span className={cn('text-[10px] font-bold ml-2 shrink-0 tabular-nums', textColor)}>
                    {e.remainMin > 0 ? `${Math.ceil(e.remainMin)} Min` : 'Fertig!'}
                  </span>
                </div>
                <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-1000', barColor)}
                    style={{ width: `${Math.min(100, e.pct)}%` }}
                  />
                </div>
                <div className="flex justify-between mt-0.5">
                  <span className="text-[9px] text-stone-400">{Math.round(e.elapsedMin)} / {e.prepMin} Min</span>
                  <span className={cn('text-[9px] font-medium', textColor)}>{Math.round(e.pct)}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-4 py-2 border-t border-stone-100 flex items-center justify-between">
        <span className="text-[10px] text-stone-400">{entries.length} aktive Bestellungen</span>
        <span className="text-[10px] text-stone-400">Aktualisiert alle 5s</span>
      </div>
    </div>
  );
}
