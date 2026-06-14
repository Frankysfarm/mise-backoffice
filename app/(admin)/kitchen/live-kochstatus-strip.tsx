'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, Clock, AlertTriangle, Flame } from 'lucide-react';

type Order = {
  id: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
};

type Timing = {
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  status: string;
};

interface Props {
  orders: Order[];
  timings: Timing[];
}

function fmtCountdown(sec: number): string {
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${sec < 0 ? '-' : ''}${m}:${String(s).padStart(2, '0')}`;
}

export function KitchenLiveKochstatusStrip({ orders, timings }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const now = Date.now();
  const cooking = orders.filter(o => o.status === 'in_zubereitung');
  const ready   = orders.filter(o => o.status === 'fertig');
  const pending = orders.filter(o => o.status === 'bestätigt');

  const urgentTiming = timings
    .filter(t => t.ready_target && cooking.some(o => o.id === t.order_id))
    .map(t => {
      const secsLeft = Math.floor((new Date(t.ready_target!).getTime() - now) / 1000);
      return { ...t, secsLeft };
    })
    .sort((a, b) => a.secsLeft - b.secsLeft)[0];

  const urgentSecs = urgentTiming?.secsLeft ?? null;

  const bandColor =
    urgentSecs !== null && urgentSecs < 0   ? 'bg-red-50 border-red-300' :
    urgentSecs !== null && urgentSecs < 120 ? 'bg-orange-50 border-orange-300' :
    urgentSecs !== null && urgentSecs < 300 ? 'bg-amber-50 border-amber-200' :
    'bg-matcha-50 border-matcha-200';

  const dotClass =
    urgentSecs !== null && urgentSecs < 0   ? 'bg-red-500' :
    urgentSecs !== null && urgentSecs < 120 ? 'bg-orange-500' :
    urgentSecs !== null && urgentSecs < 300 ? 'bg-amber-400' :
    'bg-matcha-400';

  const dotPulse =
    urgentSecs !== null && urgentSecs < 0   ? 'animate-ping' :
    urgentSecs !== null && urgentSecs < 120 ? 'animate-pulse' :
    '';

  if (cooking.length === 0 && ready.length === 0 && pending.length === 0) return null;

  return (
    <div className={cn('rounded-xl border px-4 py-2.5 flex items-center gap-4 flex-wrap', bandColor)}>
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className={cn('absolute inline-flex h-full w-full rounded-full opacity-60', dotClass, dotPulse)} />
        <span className={cn('relative inline-flex h-2.5 w-2.5 rounded-full', dotClass)} />
      </span>

      <div className="flex items-center gap-3 text-sm font-bold">
        {pending.length > 0 && (
          <span className="flex items-center gap-1 text-blue-700">
            <Clock size={13} />{pending.length} wartend
          </span>
        )}
        {cooking.length > 0 && (
          <span className="flex items-center gap-1 text-orange-700">
            <Flame size={13} />{cooking.length} kocht
          </span>
        )}
        {ready.length > 0 && (
          <span className="flex items-center gap-1 text-matcha-700">
            <CheckCircle2 size={13} />{ready.length} fertig
          </span>
        )}
      </div>

      {urgentSecs !== null && (
        <div className={cn(
          'ml-auto flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-black tabular-nums',
          urgentSecs < 0   ? 'bg-red-100 text-red-700' :
          urgentSecs < 120 ? 'bg-orange-100 text-orange-700' :
          urgentSecs < 300 ? 'bg-amber-100 text-amber-700' :
                             'bg-matcha-100 text-matcha-700',
        )}>
          {urgentSecs < 0 ? <AlertTriangle size={12} /> : <Clock size={12} />}
          {fmtCountdown(urgentSecs)}
          <span className="text-[10px] font-normal opacity-70 ml-0.5">dringlichste</span>
        </div>
      )}
    </div>
  );
}
