'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, XCircle } from 'lucide-react';
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

export function KitchenPhase2187StornoMonitor({ locationId }: { locationId?: string | null }) {
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
    const id = setInterval(load, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const { alertDrivers, totalCancelled, hasAlert } = useMemo(() => {
    if (!data) return { alertDrivers: [], totalCancelled: 0, hasAlert: false };
    const alertDrivers = data.drivers.filter((d) => d.alert);
    const totalCancelled = data.drivers.reduce((s, d) => s + d.cancelledOrders, 0);
    return { alertDrivers, totalCancelled, hasAlert: alertDrivers.length > 0 || totalCancelled >= 3 };
  }, [data]);

  if (!data) return null;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        <span>Storno-Monitor</span>
        <div className="flex items-center gap-2">
          {hasAlert && (
            <span className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 text-xs px-2 py-0.5 rounded-full">
              {totalCancelled} Stornos
            </span>
          )}
          <span className="text-xs text-gray-400">Team-Ø {data.teamAvgCancelRate}%</span>
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {hasAlert && (
            <div className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-2 text-xs',
              alertDrivers.length > 0
                ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
                : 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400'
            )}>
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {alertDrivers.length > 0
                ? `${alertDrivers.map((d) => d.name).join(', ')}: Stornoquote ≥10% — Dispatcher informieren!`
                : `${totalCancelled} Stornos heute — Stornoquote im Blick behalten.`}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <div className="text-center bg-gray-50 dark:bg-gray-800 rounded-lg py-2">
              <div className="text-lg font-bold text-gray-800 dark:text-gray-100">{totalCancelled}</div>
              <div className="text-xs text-gray-500">Stornos heute</div>
            </div>
            <div className="text-center bg-gray-50 dark:bg-gray-800 rounded-lg py-2">
              <div className={cn('text-lg font-bold', data.teamAvgCancelRate < 5 ? 'text-green-600' : data.teamAvgCancelRate < 10 ? 'text-yellow-600' : 'text-red-600')}>
                {data.teamAvgCancelRate}%
              </div>
              <div className="text-xs text-gray-500">Team heute</div>
            </div>
            <div className="text-center bg-gray-50 dark:bg-gray-800 rounded-lg py-2">
              <div className="text-lg font-bold text-gray-600 dark:text-gray-300">{data.teamAvg7d}%</div>
              <div className="text-xs text-gray-500">7d-Ø</div>
            </div>
          </div>

          {alertDrivers.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs text-gray-500 font-medium">Fahrer mit ≥10% Stornoquote:</div>
              {alertDrivers.map((d) => (
                <div key={d.id} className="flex items-center gap-2 text-xs text-red-700 dark:text-red-400">
                  <XCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{d.name} — {d.cancelRate}% ({d.cancelledOrders}/{d.totalOrders})</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
