'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Target, CheckCircle2, XCircle, RefreshCw, Euro, Clock, Bike, TrendingUp } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface StatsResponse {
  ordersToday: number;
  revenueToday: number;
  avgDeliveryMin: number;
  onTimeRatePct: number;
  driversOnline: number;
}

interface GoalMetric {
  label: string;
  current: number;
  target: number;
  unit: string;
  reverse: boolean;
  icon: React.ReactNode;
  formatValue: (v: number) => string;
}

const DEFAULT_STATS: StatsResponse = {
  ordersToday: 0,
  revenueToday: 0,
  avgDeliveryMin: 0,
  onTimeRatePct: 0,
  driversOnline: 0,
};

function getProgressColor(ratio: number): string {
  if (ratio >= 1) return 'bg-green-500';
  if (ratio >= 0.7) return 'bg-amber-400';
  return 'bg-red-500';
}

function getProgressBarWidth(ratio: number): string {
  const pct = Math.min(ratio * 100, 100);
  return `${pct}%`;
}

function isAchieved(current: number, target: number, reverse: boolean): boolean {
  if (reverse) return current <= target;
  return current >= target;
}

function getRatio(current: number, target: number, reverse: boolean): number {
  if (target === 0) return 0;
  if (reverse) {
    if (current === 0) return 1;
    return Math.min(target / current, 1);
  }
  return Math.min(current / target, 1);
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function SchichtZielErreichtPanel() {
  const [stats, setStats] = useState<StatsResponse>(DEFAULT_STATS);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/delivery/admin/stats');
      if (!res.ok) throw new Error('Bad response');
      const data: unknown = await res.json();
      if (
        data !== null &&
        typeof data === 'object' &&
        'ordersToday' in data &&
        'revenueToday' in data &&
        'avgDeliveryMin' in data &&
        'onTimeRatePct' in data &&
        'driversOnline' in data &&
        typeof (data as Record<string, unknown>).ordersToday === 'number' &&
        typeof (data as Record<string, unknown>).revenueToday === 'number' &&
        typeof (data as Record<string, unknown>).avgDeliveryMin === 'number' &&
        typeof (data as Record<string, unknown>).onTimeRatePct === 'number' &&
        typeof (data as Record<string, unknown>).driversOnline === 'number'
      ) {
        setStats(data as StatsResponse);
      } else {
        setStats(DEFAULT_STATS);
      }
    } catch {
      setStats(DEFAULT_STATS);
    } finally {
      setLoading(false);
      setLastUpdated(new Date());
    }
  }, []);

  useEffect(() => {
    fetchStats();
    intervalRef.current = setInterval(fetchStats, 60000);
    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
    };
  }, [fetchStats]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('lieferdienst-ziele-rt')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'customer_orders' },
        (payload: { new: Record<string, unknown> }) => {
          const status = payload.new?.status;
          if (status === 'geliefert' || status === 'abgeschlossen') {
            fetchStats();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchStats]);

  const goals: GoalMetric[] = [
    {
      label: 'Bestellungen',
      current: stats.ordersToday,
      target: 50,
      unit: '',
      reverse: false,
      icon: <Bike className="w-4 h-4 text-gray-500" />,
      formatValue: (v) => v.toFixed(0),
    },
    {
      label: 'Umsatz',
      current: stats.revenueToday,
      target: 1000,
      unit: '€',
      reverse: false,
      icon: <Euro className="w-4 h-4 text-gray-500" />,
      formatValue: (v) => v.toFixed(2),
    },
    {
      label: 'Pünktlichkeit',
      current: stats.onTimeRatePct,
      target: 85,
      unit: '%',
      reverse: false,
      icon: <TrendingUp className="w-4 h-4 text-gray-500" />,
      formatValue: (v) => v.toFixed(1),
    },
    {
      label: 'Ø Lieferzeit',
      current: stats.avgDeliveryMin,
      target: 35,
      unit: ' min',
      reverse: true,
      icon: <Clock className="w-4 h-4 text-gray-500" />,
      formatValue: (v) => v.toFixed(0),
    },
  ];

  const achievedCount = goals.filter((g) => isAchieved(g.current, g.target, g.reverse)).length;

  function getGesamtstatusColor(): string {
    if (achievedCount === 4) return 'text-green-600 bg-green-50 border-green-200';
    if (achievedCount >= 2) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-red-600 bg-red-50 border-red-200';
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 w-full">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-gray-700" />
          <h2 className="text-base font-semibold text-gray-800">Schichtziele Heute</h2>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated !== null && (
            <span className="text-xs text-gray-400">
              Aktualisiert: {formatTime(lastUpdated)}
            </span>
          )}
          <button
            onClick={fetchStats}
            disabled={loading}
            className="p-1.5 rounded-md hover:bg-gray-100 transition-colors disabled:opacity-50"
            aria-label="Aktualisieren"
          >
            <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {goals.map((goal) => {
          const ratio = getRatio(goal.current, goal.target, goal.reverse);
          const achieved = isAchieved(goal.current, goal.target, goal.reverse);
          const barColor = getProgressColor(ratio);
          const barWidth = getProgressBarWidth(ratio);
          const targetLabel = goal.reverse
            ? `≤ ${goal.formatValue(goal.target)}${goal.unit}`
            : `${goal.formatValue(goal.target)}${goal.unit}`;

          return (
            <div key={goal.label} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {goal.icon}
                  <span className="text-sm font-medium text-gray-700">{goal.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    {goal.formatValue(goal.current)}{goal.unit}
                    <span className="text-gray-400 mx-1">/</span>
                    {targetLabel}
                  </span>
                  {achieved ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  )}
                </div>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                  style={{ width: barWidth }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 pt-4 border-t border-gray-100">
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-semibold ${getGesamtstatusColor()}`}>
          {achievedCount === 4 ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : achievedCount >= 2 ? (
            <Target className="w-4 h-4" />
          ) : (
            <XCircle className="w-4 h-4" />
          )}
          <span>{achievedCount} / 4 Ziele erreicht</span>
        </div>
      </div>
    </div>
  );
}
