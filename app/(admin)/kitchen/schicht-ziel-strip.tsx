'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Target, TrendingUp, TrendingDown, Clock, Zap, CheckCircle2 } from 'lucide-react';

interface KitchenGoalData {
  targetOrders: number;
  actualOrders: number;
  avgPrepMin: number;
  onTimePct: number;
  pace: 'ahead' | 'on_track' | 'behind';
  projectedOrders: number;
  shiftHoursElapsed: number;
  shiftHoursTotal: number;
}

const MOCK: KitchenGoalData = {
  targetOrders: 60, actualOrders: 0, avgPrepMin: 0,
  onTimePct: 0, pace: 'on_track', projectedOrders: 0,
  shiftHoursElapsed: 0, shiftHoursTotal: 8,
};

export function KitchenSchichtZielStrip({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<KitchenGoalData>(MOCK);
  const [flash, setFlash] = useState(false);

  const load = useCallback(async () => {
    try {
      const url = `/api/delivery/admin/shift-goals${locationId ? `?location_id=${locationId}` : ''}`;
      const res = await fetch(url, { cache: 'no-store' }).catch(() => null);
      if (!res?.ok) return;
      const d = await res.json();
      setData({
        targetOrders: d.targetOrders ?? 60,
        actualOrders: d.actualOrders ?? 0,
        avgPrepMin: d.avgPrepMin ?? 0,
        onTimePct: d.onTimePct ?? 0,
        pace: d.pace ?? 'on_track',
        projectedOrders: d.projectedOrders ?? 0,
        shiftHoursElapsed: d.shiftHoursElapsed ?? 0,
        shiftHoursTotal: d.shiftHoursTotal ?? 8,
      });
    } catch {}
  }, [locationId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 60_000);
    const supabase = createClient();
    const ch = supabase
      .channel('kitchen-schicht-ziel')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'customer_orders' },
        (payload: { new: Record<string, unknown> }) => {
          const row = payload.new as Record<string, unknown>;
          if (row.status === 'fertig' || row.status === 'geliefert') {
            setFlash(true);
            setTimeout(() => setFlash(false), 1200);
            load();
          }
        })
      .subscribe();
    return () => { clearInterval(iv); supabase.removeChannel(ch); };
  }, [load]);

  const pct = data.targetOrders > 0 ? Math.min(100, Math.round((data.actualOrders / data.targetOrders) * 100)) : 0;
  const paceColor = data.pace === 'ahead' ? 'text-matcha-300' : data.pace === 'on_track' ? 'text-amber-300' : 'text-red-400';
  const paceIcon = data.pace === 'ahead' ? TrendingUp : data.pace === 'on_track' ? Target : TrendingDown;
  const PaceIcon = paceIcon;
  const barColor = pct >= 100 ? 'bg-matcha-400' : pct >= 75 ? 'bg-amber-400' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500';

  const shiftPct = data.shiftHoursTotal > 0
    ? Math.min(100, Math.round((data.shiftHoursElapsed / data.shiftHoursTotal) * 100))
    : 0;

  return (
    <div className={cn(
      'rounded-xl border bg-matcha-900/50 px-3 py-2.5 transition-all duration-500',
      flash ? 'border-matcha-400/70 bg-matcha-800/60' : 'border-matcha-700/40',
    )}>
      <div className="flex items-center gap-3 flex-wrap">
        {/* Header */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Target className="h-3.5 w-3.5 text-accent" />
          <span className="text-[10px] font-black uppercase tracking-widest text-matcha-300">Schicht-Ziel</span>
        </div>

        {/* Orders progress */}
        <div className="flex items-center gap-2 flex-1 min-w-[140px]">
          <span className="tabular-nums text-sm font-black text-white">
            {data.actualOrders}
            <span className="text-matcha-500 font-normal text-xs">/{data.targetOrders}</span>
          </span>
          <div className="flex-1 h-1.5 bg-matcha-800/80 rounded-full overflow-hidden min-w-[60px]">
            <div
              className={cn('h-full rounded-full transition-all duration-700', barColor, flash && 'animate-pulse')}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-[10px] font-bold tabular-nums text-matcha-400">{pct}%</span>
        </div>

        {/* Pace */}
        <div className={cn('flex items-center gap-1 shrink-0', paceColor)}>
          <PaceIcon className="h-3 w-3" />
          <span className="text-[10px] font-bold uppercase tracking-wide">
            {data.pace === 'ahead' ? 'Über Ziel' : data.pace === 'on_track' ? 'Im Plan' : 'Hinter Plan'}
          </span>
        </div>

        {/* Avg prep time */}
        {data.avgPrepMin > 0 && (
          <div className={cn(
            'flex items-center gap-1 shrink-0',
            data.avgPrepMin <= 20 ? 'text-matcha-300' : data.avgPrepMin <= 30 ? 'text-amber-300' : 'text-red-400',
          )}>
            <Clock className="h-3 w-3" />
            <span className="text-[10px] font-bold tabular-nums">⌀ {Math.round(data.avgPrepMin)} Min</span>
          </div>
        )}

        {/* On-time rate */}
        {data.onTimePct > 0 && (
          <div className={cn(
            'flex items-center gap-1 shrink-0',
            data.onTimePct >= 85 ? 'text-matcha-300' : data.onTimePct >= 70 ? 'text-amber-300' : 'text-red-400',
          )}>
            <CheckCircle2 className="h-3 w-3" />
            <span className="text-[10px] font-bold tabular-nums">{Math.round(data.onTimePct)}% pünktlich</span>
          </div>
        )}

        {/* Shift time progress */}
        {data.shiftHoursTotal > 0 && (
          <div className="flex items-center gap-1.5 shrink-0">
            <Zap className="h-3 w-3 text-matcha-500" />
            <div className="flex items-center gap-1">
              <div className="w-14 h-1 bg-matcha-800/80 rounded-full overflow-hidden">
                <div className="h-full bg-matcha-600/70 rounded-full transition-all duration-700" style={{ width: `${shiftPct}%` }} />
              </div>
              <span className="text-[9px] text-matcha-500 tabular-nums">
                {Math.round(data.shiftHoursElapsed * 10) / 10}h/{data.shiftHoursTotal}h
              </span>
            </div>
          </div>
        )}

        {/* Projected */}
        {data.projectedOrders > 0 && data.projectedOrders !== data.actualOrders && (
          <div className="ml-auto shrink-0">
            <span className="text-[9px] text-matcha-500">
              Prognose: <span className={cn('font-bold', data.projectedOrders >= data.targetOrders ? 'text-matcha-300' : 'text-red-400')}>
                {data.projectedOrders}
              </span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
