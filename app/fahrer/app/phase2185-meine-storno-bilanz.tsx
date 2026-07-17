'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Lightbulb, TrendingDown, TrendingUp, Minus } from 'lucide-react';
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
}

const TIPPS: Record<string, string> = {
  gut: 'Super! Deine Stornoquote ist sehr niedrig. Weiter so!',
  mittel: 'Deine Quote ist im mittleren Bereich. Kommuniziere Verzögerungen proaktiv.',
  hoch: 'Stornoquote zu hoch. Checke Routen und Erreichbarkeit der Kunden.',
};

export function FahrerPhase2185MeineStornoBilanz({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    if (!isOnline) return;
    try {
      const url = locationId
        ? `/api/delivery/admin/fahrer-storno-analyse?location_id=${locationId}`
        : '/api/delivery/admin/fahrer-storno-analyse';
      const res = await fetch(url);
      if (res.ok) setData(await res.json());
    } catch {
      // ignore
    }
  }, [locationId, isOnline]);

  useEffect(() => {
    load();
    const id = setInterval(load, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!isOnline || !data) return null;

  const me = driverId ? data.drivers.find((d) => d.id === driverId) : data.drivers[0];
  if (!me) return null;

  const tippKey = me.cancelRate < 5 ? 'gut' : me.cancelRate < 10 ? 'mittel' : 'hoch';
  const color = me.cancelRate < 5 ? 'text-green-600' : me.cancelRate < 10 ? 'text-yellow-600' : 'text-red-600';

  function TrendIcon({ trend }: { trend: 'up' | 'down' | 'neutral' }) {
    if (trend === 'up') return <TrendingUp className="w-4 h-4 text-red-500" />;
    if (trend === 'down') return <TrendingDown className="w-4 h-4 text-green-500" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        <span>Meine Storno-Bilanz</span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className={cn('text-3xl font-bold', color)}>{me.cancelRate}%</div>
              <div className="text-xs text-gray-500 mt-0.5">Stornoquote heute</div>
            </div>
            <div className="text-right">
              <TrendIcon trend={me.trend} />
              <div className="text-xs text-gray-400 mt-1">7d-Ø {me.cancelRate7d}%</div>
              <div className="text-xs text-gray-400">Team-Ø {data.teamAvgCancelRate}%</div>
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-500 mb-1">{me.cancelledOrders} von {me.totalOrders} Aufträgen storniert</div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={cn('h-2 rounded-full', me.cancelRate < 5 ? 'bg-green-500' : me.cancelRate < 10 ? 'bg-yellow-500' : 'bg-red-500')}
                style={{ width: `${Math.min(100, me.cancelRate * 5)}%` }}
              />
            </div>
          </div>

          <div className="flex items-start gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2 text-xs text-gray-600 dark:text-gray-300">
            <Lightbulb className="w-3.5 h-3.5 text-yellow-500 mt-0.5 shrink-0" />
            <span>{TIPPS[tippKey]}</span>
          </div>
        </div>
      )}
    </div>
  );
}
