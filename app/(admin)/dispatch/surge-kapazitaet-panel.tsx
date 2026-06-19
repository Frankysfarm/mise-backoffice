'use client';

import { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, Bike, TrendingUp, CheckCircle2, Users, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SurgeAlert {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  window_min: number;
  z_score: number;
  current_rate: number;
  baseline_rate: number;
  detected_at: string;
}

interface DriverStats {
  online: number;
  onTour: number;
  available: number;
}

interface Props {
  locationId: string;
  driverStats?: DriverStats;
}

const SEVERITY_COLOR: Record<string, string> = {
  low:      'text-yellow-600 bg-yellow-50 border-yellow-200',
  medium:   'text-orange-600 bg-orange-50 border-orange-200',
  high:     'text-red-600 bg-red-50 border-red-200',
  critical: 'text-red-800 bg-red-100 border-red-400',
};

export function DispatchSurgeKapazitaetPanel({ locationId, driverStats }: Props) {
  const [alerts, setAlerts] = useState<SurgeAlert[]>([]);
  const [trendDir, setTrendDir] = useState<'rising' | 'falling' | 'stable'>('stable');
  const [, setTick] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/delivery/surge?locationId=${locationId}`, { cache: 'no-store' });
      if (!res.ok) return;
      const body = await res.json() as { ok: boolean; dashboard: { activeAlerts: SurgeAlert[]; trendDirection: 'rising' | 'falling' | 'stable' } };
      if (body.ok) {
        setAlerts(body.dashboard.activeAlerts ?? []);
        setTrendDir(body.dashboard.trendDirection ?? 'stable');
      }
    } catch {}
  }, [locationId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 90_000);
    return () => clearInterval(iv);
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const topAlert = alerts.reduce<SurgeAlert | null>((prev, curr) => {
    if (!prev) return curr;
    const order = ['critical', 'high', 'medium', 'low'];
    return order.indexOf(curr.severity) < order.indexOf(prev.severity) ? curr : prev;
  }, null);

  const available = driverStats?.available ?? 0;
  const onTour = driverStats?.onTour ?? 0;
  const online = driverStats?.online ?? 0;

  // Estimate needed drivers based on surge rate
  const surgeRate = topAlert?.current_rate ?? 0;
  const baselineRate = topAlert?.baseline_rate ?? 0;
  const surgeExcess = Math.max(0, surgeRate - baselineRate);
  // Rough heuristic: 1 extra driver per 2 extra orders/10min
  const neededExtra = Math.ceil(surgeExcess / 2);
  const capacity = available;
  const gap = neededExtra - capacity;

  if (!topAlert) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-3">
        <CheckCircle2 size={14} className="text-green-600 shrink-0" />
        <span className="text-xs text-green-700">Keine Nachfrage-Anomalie — Kapazität normal</span>
      </div>
    );
  }

  const colorClass = SEVERITY_COLOR[topAlert.severity] ?? SEVERITY_COLOR.medium;
  const excess = topAlert.current_rate > 0 && topAlert.baseline_rate > 0
    ? Math.round(((topAlert.current_rate - topAlert.baseline_rate) / topAlert.baseline_rate) * 100)
    : 0;

  return (
    <div className={cn('rounded-xl border p-3 space-y-2.5', colorClass)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {topAlert.severity === 'critical' ? (
            <Zap size={15} className="shrink-0" />
          ) : (
            <AlertTriangle size={15} className="shrink-0" />
          )}
          <span className="text-sm font-semibold">
            Surge-Warnung · +{excess}% Nachfrage
          </span>
        </div>
        <span className="text-xs font-mono opacity-70">Z={topAlert.z_score.toFixed(1)}</span>
      </div>

      {/* Kapazitätsbalken */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs opacity-80">
          <span>Fahrer-Kapazität</span>
          <span>{available} frei / {online} online</span>
        </div>
        <div className="h-2.5 bg-white/50 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              gap > 0 ? 'bg-red-500' : 'bg-green-500',
            )}
            style={{ width: `${Math.min(100, online > 0 ? (available / Math.max(online, 1)) * 100 : 0)}%` }}
          />
        </div>
      </div>

      {/* Fahrer-Status Chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 text-xs bg-white/50 rounded px-2 py-0.5">
          <Bike size={11} />
          <span>{onTour} auf Tour</span>
        </div>
        <div className="flex items-center gap-1 text-xs bg-white/50 rounded px-2 py-0.5">
          <Users size={11} />
          <span>{available} verfügbar</span>
        </div>
        {gap > 0 && (
          <div className="flex items-center gap-1 text-xs bg-red-200/80 rounded px-2 py-0.5 font-medium">
            <AlertTriangle size={11} />
            <span>+{gap} Fahrer benötigt</span>
          </div>
        )}
      </div>

      {trendDir === 'rising' && (
        <div className="flex items-center gap-1">
          <TrendingUp size={11} className="shrink-0" />
          <span className="text-xs font-medium">Nachfrage steigt weiter — Fahrer vorausplanen</span>
        </div>
      )}
    </div>
  );
}
