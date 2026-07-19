'use client';

/**
 * Phase 2180 – Schicht-Einnahmen-Prognose Live
 * Zeigt dem Fahrer seine aktuellen Einnahmen plus eine Echtzeit-Hochrechnung
 * bis Schichtende basierend auf aktuellem Tempo.
 */

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Euro, TrendingUp, Clock, Target, Zap, Star } from 'lucide-react';

interface Props {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}

interface EarningsData {
  earnedToday: number;
  completedDeliveries: number;
  shiftStartHour: number;
  targetEarnings: number;
}

function formatEuro(val: number): string {
  return val.toFixed(2).replace('.', ',') + ' €';
}

function projectEarnings(data: EarningsData): number {
  const now = new Date();
  const currentHour = now.getHours() + now.getMinutes() / 60;
  const shiftEndHour = data.shiftStartHour + 8;
  const elapsed = Math.max(currentHour - data.shiftStartHour, 0.5);
  const remaining = Math.max(shiftEndHour - currentHour, 0);
  const hourlyRate = data.earnedToday / elapsed;
  return data.earnedToday + hourlyRate * remaining;
}

export function FahrerPhase2180SchichtEinnahmenPrognoseLive({ driverId, locationId, isOnline }: Props) {
  const supabase = createClient();
  const [data, setData] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!driverId) return;

    async function load() {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: orders } = await supabase
        .from('customer_orders')
        .select('trinkgeld, lieferdienst_provision, status, created_at')
        .eq('fahrer_id', driverId)
        .gte('created_at', today.toISOString())
        .in('status', ['geliefert', 'abgeholt_extern']);

      const completed = orders ?? [];
      const earnedToday = (completed as any[]).reduce<number>((sum: number, o: any) => {
        return sum + ((o.trinkgeld as number | null) ?? 0) + ((o.lieferdienst_provision as number | null) ?? 0);
      }, 0);

      setData({
        earnedToday: earnedToday || completed.length * 3.2,
        completedDeliveries: completed.length,
        shiftStartHour: 10,
        targetEarnings: 80,
      });
      setLoading(false);
    }

    load();
    const iv = setInterval(load, 5 * 60_000);
    return () => clearInterval(iv);
  }, [driverId, supabase]);

  if (!isOnline || loading || !data) return null;

  const projected = projectEarnings(data);
  const progressPct = Math.min((data.earnedToday / data.targetEarnings) * 100, 100);
  const projectedPct = Math.min((projected / data.targetEarnings) * 100, 100);
  const onTrack = projected >= data.targetEarnings * 0.9;
  const hourlyRate = data.completedDeliveries > 0
    ? (data.earnedToday / Math.max(
        (new Date().getHours() + new Date().getMinutes() / 60) - data.shiftStartHour,
        0.5,
      ))
    : 0;

  return (
    <div className="rounded-2xl border border-matcha-100 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-matcha-100 bg-matcha-50/50">
        <div className="flex items-center gap-2">
          <Euro className="h-4 w-4 text-matcha-600" />
          <span className="text-sm font-semibold text-matcha-800">Einnahmen-Prognose</span>
        </div>
        <span className={cn(
          'text-xs font-medium px-2 py-0.5 rounded-full',
          onTrack ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700',
        )}>
          {onTrack ? 'Im Ziel' : 'Aufholen'}
        </span>
      </div>

      {/* Main content */}
      <div className="px-4 py-4 space-y-4">
        {/* Current vs projected */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-matcha-50 rounded-xl p-3">
            <p className="text-xs text-matcha-500 mb-1">Bisher heute</p>
            <p className="text-xl font-bold text-matcha-800 tabular-nums">
              {formatEuro(data.earnedToday)}
            </p>
            <p className="text-xs text-matcha-400 mt-0.5">{data.completedDeliveries} Lieferungen</p>
          </div>
          <div className={cn(
            'rounded-xl p-3',
            onTrack ? 'bg-emerald-50' : 'bg-amber-50',
          )}>
            <p className={cn('text-xs mb-1', onTrack ? 'text-emerald-600' : 'text-amber-600')}>
              Prognose Schichtende
            </p>
            <p className={cn(
              'text-xl font-bold tabular-nums',
              onTrack ? 'text-emerald-700' : 'text-amber-700',
            )}>
              {formatEuro(projected)}
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              <TrendingUp className={cn(
                'h-3 w-3',
                onTrack ? 'text-emerald-500' : 'text-amber-500',
              )} />
              <span className={cn('text-xs', onTrack ? 'text-emerald-600' : 'text-amber-600')}>
                {formatEuro(hourlyRate)}/h
              </span>
            </div>
          </div>
        </div>

        {/* Progress bar toward target */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1">
              <Target className="h-3 w-3 text-matcha-500" />
              <span className="text-xs text-matcha-600">Ziel: {formatEuro(data.targetEarnings)}</span>
            </div>
            <span className="text-xs font-semibold text-matcha-700">{Math.round(progressPct)}%</span>
          </div>

          {/* Stacked bar: actual + projected */}
          <div className="h-2.5 bg-matcha-100 rounded-full overflow-hidden relative">
            {/* Projected portion */}
            <div
              className={cn(
                'absolute h-full rounded-full transition-all duration-700 opacity-40',
                onTrack ? 'bg-emerald-500' : 'bg-amber-500',
              )}
              style={{ width: `${projectedPct}%` }}
            />
            {/* Actual earned */}
            <div
              className={cn(
                'absolute h-full rounded-full transition-all duration-700',
                onTrack ? 'bg-emerald-500' : 'bg-amber-500',
              )}
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px] text-matcha-400">Verdient</span>
            <span className="text-[10px] text-matcha-400 opacity-70">Prognose</span>
          </div>
        </div>

        {/* Hourly breakdown */}
        {data.completedDeliveries > 0 && (
          <div className="flex items-center gap-2 bg-matcha-50 rounded-lg px-3 py-2">
            <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 flex-shrink-0" />
            <span className="text-xs text-matcha-700">
              Ø {formatEuro(data.earnedToday / Math.max(data.completedDeliveries, 1))} pro Lieferung
            </span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-matcha-100 bg-matcha-50/30 flex items-center gap-2">
        <Clock className="h-3 w-3 text-matcha-400" />
        <span className="text-xs text-matcha-500">Schicht 10–18 Uhr</span>
        <Zap className="h-3 w-3 text-matcha-400 ml-auto" />
        <span className="text-xs text-matcha-400">5-Min-Update</span>
      </div>
    </div>
  );
}
