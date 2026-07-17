'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, BarChart2 } from 'lucide-react';

interface DriverTrend {
  driver_id: string;
  name: string;
  scores: number[];
  avg: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  alert: boolean;
}

interface ApiData {
  drivers: DriverTrend[];
  last_updated: string;
}

const MOCK: ApiData = {
  drivers: [
    { driver_id: 'd1', name: 'Max M.',   scores: [72, 75, 78, 80, 83, 85, 88], avg: 80, trend: 'steigend',  trend_delta: 16, alert: false },
    { driver_id: 'd2', name: 'Sarah K.', scores: [90, 89, 87, 85, 84, 82, 80], avg: 85, trend: 'fallend',   trend_delta: -10, alert: false },
    { driver_id: 'd3', name: 'Tom B.',   scores: [55, 58, 54, 57, 55, 56, 54], avg: 56, trend: 'stabil',    trend_delta: -1, alert: true },
    { driver_id: 'd4', name: 'Anna L.',  scores: [78, 80, 81, 83, 85, 87, 90], avg: 83, trend: 'steigend',  trend_delta: 12, alert: false },
  ],
  last_updated: new Date().toISOString(),
};

const POLL_MS = 15 * 60_000;

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp className="w-3.5 h-3.5 text-green-400" />;
  if (trend === 'fallend')  return <TrendingDown className="w-3.5 h-3.5 text-red-400" />;
  return <Minus className="w-3.5 h-3.5 text-gray-400" />;
}

function MiniSparkline({ scores }: { scores: number[] }) {
  if (scores.length < 2) return null;
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;
  const w = 60;
  const h = 20;
  const pts = scores
    .map((s, i) => {
      const x = (i / (scores.length - 1)) * w;
      const y = h - ((s - min) / range) * h;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={w} height={h} className="shrink-0">
      <polyline points={pts} fill="none" stroke="#6ee7b7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DispatchPhase2044ScoreTrendAnalyseBoard({
  locationId,
  className,
}: {
  locationId: string | null;
  className?: string;
}) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData>(MOCK);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/fahrer-score-trend?location_id=${locationId}&days=7`);
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

  const alertCount = data.drivers.filter(d => d.alert).length;

  return (
    <div className={cn('rounded-xl border border-gray-800 bg-gray-900 overflow-hidden', className)}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-100 hover:bg-gray-800 transition-colors"
      >
        <span className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-indigo-400" />
          Score-Trend-Analyse (7 Tage)
          {alertCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-xs bg-red-900 text-red-300">
              {alertCount} unter Ziel
            </span>
          )}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {data.drivers.map(d => (
            <div key={d.driver_id} className={cn(
              'rounded-lg p-3 space-y-2',
              d.alert ? 'bg-red-950 border border-red-800' : 'bg-gray-800',
            )}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendIcon trend={d.trend} />
                  <span className="text-sm font-semibold text-gray-100">{d.name}</span>
                  {d.trend !== 'stabil' && (
                    <span className={cn(
                      'text-[10px] font-bold',
                      d.trend === 'steigend' ? 'text-green-400' : 'text-red-400',
                    )}>
                      {d.trend_delta > 0 ? '+' : ''}{d.trend_delta}
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <div className={cn(
                    'text-sm font-black tabular-nums',
                    d.avg >= 80 ? 'text-green-400' : d.avg >= 60 ? 'text-amber-400' : 'text-red-400',
                  )}>
                    Ø {d.avg}
                  </div>
                  <div className="text-[9px] text-gray-500">Score</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <MiniSparkline scores={d.scores} />
                <div className="flex gap-1 flex-1">
                  {d.scores.map((s, i) => (
                    <div
                      key={i}
                      className={cn(
                        'flex-1 rounded-sm',
                        s >= 80 ? 'bg-green-600' : s >= 60 ? 'bg-amber-500' : 'bg-red-600',
                      )}
                      style={{ height: `${Math.max(4, (s / 100) * 24)}px` }}
                      title={`Tag ${i + 1}: ${s}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          ))}

          {data.drivers.length === 0 && (
            <p className="text-xs text-gray-500 text-center py-2">Keine Fahrer-Daten verfügbar</p>
          )}
        </div>
      )}
    </div>
  );
}
