'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Zap, ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerReaktionszeit {
  driver_id: string;
  name: string;
  avg_min: number;
  auftraege: number;
  trend: 'besser' | 'gleich' | 'schlechter';
  trend_delta: number;
  alert: boolean;
}

interface ReaktionszeitData {
  fahrer: FahrerReaktionszeit[];
  team_avg_min: number;
  alert_count: number;
}

const MOCK: ReaktionszeitData = {
  fahrer: [
    { driver_id: 'd1', name: 'Max M.', avg_min: 3.2, auftraege: 12, trend: 'besser', trend_delta: -0.8, alert: false },
    { driver_id: 'd2', name: 'Sarah K.', avg_min: 5.1, auftraege: 9, trend: 'gleich', trend_delta: 0, alert: false },
    { driver_id: 'd4', name: 'Anna L.', avg_min: 4.0, auftraege: 11, trend: 'besser', trend_delta: -1.2, alert: false },
    { driver_id: 'd3', name: 'Tom B.', avg_min: 11.4, auftraege: 7, trend: 'schlechter', trend_delta: 2.3, alert: true },
  ],
  team_avg_min: 5.9,
  alert_count: 1,
};

const POLL_MS = 30 * 60 * 1000;

function barColor(avg: number) {
  if (avg <= 5) return 'bg-green-500';
  if (avg <= 10) return 'bg-amber-400';
  return 'bg-red-500';
}

function textColor(avg: number) {
  if (avg <= 5) return 'text-green-400';
  if (avg <= 10) return 'text-amber-400';
  return 'text-red-400';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'besser') return <TrendingUp className="w-3 h-3 text-green-400" />;
  if (trend === 'schlechter') return <TrendingDown className="w-3 h-3 text-red-400" />;
  return <Minus className="w-3 h-3 text-gray-400" />;
}

export function DispatchPhase2056ReaktionsteitRangliste({
  locationId,
  className,
}: {
  locationId: string | null;
  className?: string;
}) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ReaktionszeitData | null>(null);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/fahrer-reaktionszeit?location_id=${locationId}`);
        if (!res.ok) throw new Error();
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData(MOCK);
      }
    };
    load();
    const iv = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  const d = data ?? MOCK;

  const maxAvg = Math.max(...d.fahrer.map(f => f.avg_min), 15);

  return (
    <div className={cn('rounded-xl border border-gray-800 bg-gray-900 overflow-hidden', className)}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-100 hover:bg-gray-800 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-yellow-400" />
          Reaktionszeit-Rangliste
          {d.alert_count > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs bg-red-900 text-red-300">
              {d.alert_count} langsam
            </span>
          )}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {d.alert_count > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-red-950 border border-red-800 px-3 py-2 text-xs text-red-300">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              {d.alert_count} Fahrer mit Reaktionszeit &gt;10 Min — Optimierungsbedarf
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg bg-gray-800 px-3 py-2 text-xs text-gray-300">
            <span>Team-Ø Reaktionszeit</span>
            <span className={cn('font-bold text-sm', textColor(d.team_avg_min))}>
              {d.team_avg_min} Min
            </span>
          </div>

          <div className="space-y-2.5">
            {d.fahrer.map((f, i) => (
              <div key={f.driver_id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-gray-200">
                    <span className="text-gray-500 w-4">{i + 1}.</span>
                    {f.alert && <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" />}
                    {f.name}
                    <TrendIcon trend={f.trend} />
                    {f.trend !== 'gleich' && (
                      <span className={cn(
                        'text-[10px]',
                        f.trend === 'besser' ? 'text-green-400' : 'text-red-400',
                      )}>
                        {f.trend_delta > 0 ? '+' : ''}{f.trend_delta} Min
                      </span>
                    )}
                  </span>
                  <span className={cn('font-semibold', textColor(f.avg_min))}>
                    {f.avg_min} Min
                    <span className="text-gray-500 font-normal ml-1">({f.auftraege} Auftr.)</span>
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-700 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', barColor(f.avg_min))}
                    style={{ width: `${Math.min((f.avg_min / maxAvg) * 100, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
