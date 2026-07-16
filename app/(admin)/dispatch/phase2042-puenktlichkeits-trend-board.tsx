'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerPuenktlichkeit {
  driver_id: string;
  name: string;
  rate: number;
  on_time: number;
  total: number;
  trend: 'besser' | 'gleich' | 'schlechter';
  trend_delta: number;
}

interface PuenktlichkeitsData {
  fahrer: FahrerPuenktlichkeit[];
  team_avg: number;
  alert_count: number;
}

const MOCK: PuenktlichkeitsData = {
  fahrer: [
    { driver_id: 'd1', name: 'Max M.', rate: 96, on_time: 48, total: 50, trend: 'besser', trend_delta: 3 },
    { driver_id: 'd2', name: 'Sarah K.', rate: 91, on_time: 40, total: 44, trend: 'gleich', trend_delta: 0 },
    { driver_id: 'd3', name: 'Tom B.', rate: 82, on_time: 36, total: 44, trend: 'schlechter', trend_delta: -5 },
    { driver_id: 'd4', name: 'Anna L.', rate: 94, on_time: 33, total: 35, trend: 'besser', trend_delta: 2 },
  ],
  team_avg: 91,
  alert_count: 1,
};

const POLL_MS = 30 * 60 * 1000;

function rateColor(rate: number) {
  if (rate >= 90) return 'text-green-400';
  if (rate >= 80) return 'text-amber-400';
  return 'text-red-400';
}

function barColor(rate: number) {
  if (rate >= 90) return 'bg-green-500';
  if (rate >= 80) return 'bg-amber-400';
  return 'bg-red-500';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'besser') return <TrendingUp className="w-3 h-3 text-green-400" />;
  if (trend === 'schlechter') return <TrendingDown className="w-3 h-3 text-red-400" />;
  return <Minus className="w-3 h-3 text-gray-400" />;
}

export function DispatchPhase2042PuenktlichkeitsTrendBoard({
  locationId,
  className,
}: {
  locationId: string | null;
  className?: string;
}) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<PuenktlichkeitsData | null>(null);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/schicht-puenktlichkeits-score?location_id=${locationId}`);
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

  return (
    <div className={cn('rounded-xl border border-gray-800 bg-gray-900 overflow-hidden', className)}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-100 hover:bg-gray-800 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-400" />
          Pünktlichkeits-Ranking
          {d.alert_count > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs bg-red-900 text-red-300">
              {d.alert_count} unter Ziel
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
              {d.alert_count} Fahrer unter 90% Pünktlichkeit — Optimierungsbedarf
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg bg-gray-800 px-3 py-2 text-xs text-gray-300">
            <span>Team-Pünktlichkeit</span>
            <span className={cn('font-bold text-sm', rateColor(d.team_avg))}>{d.team_avg}%</span>
          </div>

          <div className="space-y-2">
            {d.fahrer.map((f, i) => (
              <div key={f.driver_id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-gray-200">
                    <span className="text-gray-500 w-4">{i + 1}.</span>
                    {f.rate < 90 && <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" />}
                    {f.name}
                    <TrendIcon trend={f.trend} />
                    {f.trend !== 'gleich' && (
                      <span className={cn('text-[10px]', f.trend === 'besser' ? 'text-green-400' : 'text-red-400')}>
                        {f.trend_delta > 0 ? '+' : ''}{f.trend_delta}%
                      </span>
                    )}
                  </span>
                  <span className={cn('font-semibold', rateColor(f.rate))}>
                    {f.rate}%
                    <span className="text-gray-500 font-normal ml-1">({f.on_time}/{f.total})</span>
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-700 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', barColor(f.rate))}
                    style={{ width: `${f.rate}%` }}
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
