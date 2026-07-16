'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Star, ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerBewertungsTrend {
  driver_id: string;
  name: string;
  avg_bewertung: number;
  bewertungs_count: number;
  trend: 'steigend' | 'stabil' | 'fallend';
  trend_delta: number;
  alert_niedrig: boolean;
}

interface BewertungsData {
  fahrer: FahrerBewertungsTrend[];
  team_avg: number;
  alert_count: number;
}

const MOCK: BewertungsData = {
  fahrer: [
    { driver_id: 'd1', name: 'Max M.', avg_bewertung: 4.8, bewertungs_count: 42, trend: 'steigend', trend_delta: 0.2, alert_niedrig: false },
    { driver_id: 'd2', name: 'Sarah K.', avg_bewertung: 4.5, bewertungs_count: 31, trend: 'stabil', trend_delta: 0.0, alert_niedrig: false },
    { driver_id: 'd3', name: 'Tom B.', avg_bewertung: 3.2, bewertungs_count: 18, trend: 'fallend', trend_delta: -0.4, alert_niedrig: true },
    { driver_id: 'd4', name: 'Anna L.', avg_bewertung: 4.1, bewertungs_count: 27, trend: 'steigend', trend_delta: 0.1, alert_niedrig: false },
  ],
  team_avg: 4.15,
  alert_count: 1,
};

const POLL_MS = 30 * 60 * 1000;

function starColor(rating: number) {
  if (rating >= 4.5) return 'text-green-500';
  if (rating >= 3.5) return 'text-amber-500';
  return 'text-red-500';
}

function barColor(rating: number) {
  if (rating >= 4.5) return 'bg-green-500';
  if (rating >= 3.5) return 'bg-amber-400';
  return 'bg-red-500';
}

function TrendIcon({ trend, delta }: { trend: string; delta: number }) {
  if (trend === 'steigend') return <TrendingUp className="w-3 h-3 text-green-500" />;
  if (trend === 'fallend') return <TrendingDown className="w-3 h-3 text-red-500" />;
  return <Minus className="w-3 h-3 text-gray-400" />;
}

export function DispatchPhase2037BewertungsTrendLeaderboard({
  locationId,
  className,
}: {
  locationId: string | null;
  className?: string;
}) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<BewertungsData | null>(null);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/fahrer-bewertungs-trend?location_id=${locationId}`);
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
          <Star className="w-4 h-4 text-yellow-400" />
          Fahrer-Bewertungs-Leaderboard
          {d.alert_count > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs bg-red-900 text-red-300">
              {d.alert_count} Alarm
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
              {d.alert_count} Fahrer mit Bewertung unter 3.5 — sofortige Betreuung empfohlen
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg bg-gray-800 px-3 py-2 text-xs text-gray-300">
            <span>Team-Ø</span>
            <span className={cn('font-bold text-sm', starColor(d.team_avg))}>
              ★ {d.team_avg.toFixed(1)}
            </span>
          </div>

          <div className="space-y-2">
            {d.fahrer.map((f, i) => (
              <div key={f.driver_id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-gray-200">
                    <span className="text-gray-500 w-4">{i + 1}.</span>
                    {f.alert_niedrig && <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" />}
                    {f.name}
                    <TrendIcon trend={f.trend} delta={f.trend_delta} />
                    {f.trend !== 'stabil' && (
                      <span className={cn('text-[10px]', f.trend === 'steigend' ? 'text-green-400' : 'text-red-400')}>
                        {f.trend_delta > 0 ? '+' : ''}{f.trend_delta.toFixed(1)}
                      </span>
                    )}
                  </span>
                  <span className={cn('font-semibold', starColor(f.avg_bewertung))}>
                    ★ {f.avg_bewertung.toFixed(1)}
                    <span className="text-gray-500 font-normal ml-1">({f.bewertungs_count})</span>
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-700 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', barColor(f.avg_bewertung))}
                    style={{ width: `${(f.avg_bewertung / 5) * 100}%` }}
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
