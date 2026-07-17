'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DriverStorno {
  id: string;
  name: string;
  totalOrders: number;
  cancelledOrders: number;
  cancelRate: number;
  cancelRate7d: number;
  trend: 'up' | 'down' | 'neutral';
  alert: boolean;
}

interface ApiData {
  ok: boolean;
  drivers: DriverStorno[];
  teamAvgCancelRate: number;
  teamAvg7d: number;
}

export function DispatchPhase2184StornoAnalyseBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    try {
      const url = locationId
        ? `/api/delivery/admin/fahrer-storno-analyse?location_id=${locationId}`
        : '/api/delivery/admin/fahrer-storno-analyse';
      const res = await fetch(url);
      if (res.ok) setData(await res.json());
    } catch {
      // ignore
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!data) return null;

  const alertDrivers = data.drivers.filter((d) => d.alert);
  const sorted = [...data.drivers].sort((a, b) => b.cancelRate - a.cancelRate);

  function ampel(rate: number) {
    if (rate < 5) return 'text-green-600';
    if (rate < 10) return 'text-yellow-600';
    return 'text-red-600';
  }

  function TrendIcon({ trend }: { trend: 'up' | 'down' | 'neutral' }) {
    if (trend === 'up') return <TrendingUp className="w-3 h-3 text-red-500" />;
    if (trend === 'down') return <TrendingDown className="w-3 h-3 text-green-500" />;
    return <Minus className="w-3 h-3 text-gray-400" />;
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        <span>Storno-Analyse Board</span>
        <div className="flex items-center gap-2">
          {alertDrivers.length > 0 && (
            <span className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {alertDrivers.length} Alert
            </span>
          )}
          <span className="text-xs text-gray-400">Team-Ø {data.teamAvgCancelRate}%</span>
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {alertDrivers.length > 0 && (
            <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 text-xs text-red-700 dark:text-red-400">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                {alertDrivers.map((d) => d.name).join(', ')} — Stornoquote ≥10%! Ursache prüfen.
              </span>
            </div>
          )}

          <div className="space-y-2">
            {sorted.map((d) => (
              <div key={d.id} className="rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{d.name}</span>
                  <div className="flex items-center gap-1.5">
                    <TrendIcon trend={d.trend} />
                    <span className={cn('text-sm font-bold', ampel(d.cancelRate))}>
                      {d.cancelRate}%
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mb-1">
                  <div
                    className={cn(
                      'h-1.5 rounded-full',
                      d.cancelRate < 5 ? 'bg-green-500' : d.cancelRate < 10 ? 'bg-yellow-500' : 'bg-red-500'
                    )}
                    style={{ width: `${Math.min(100, d.cancelRate * 5)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>{d.cancelledOrders}/{d.totalOrders} Stornos</span>
                  <span>7d-Ø {d.cancelRate7d}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
