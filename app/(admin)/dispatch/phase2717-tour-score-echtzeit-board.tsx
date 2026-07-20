'use client';
import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Trophy, Star, AlertTriangle, Route } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DriverScore {
  driver_id: string;
  driver_name: string;
  score: number;
  pünktlichkeit: number;
  effizienz: number;
  kundenzufriedenheit: number;
  touren_heute: number;
  trend: 'steigend' | 'fallend' | 'stabil';
}

interface ApiData {
  drivers: DriverScore[];
  team_avg_score: number;
  best_score: number;
  best_driver: string;
}

function scoreFarbe(score: number): 'gruen' | 'gelb' | 'rot' {
  if (score >= 85) return 'gruen';
  if (score >= 70) return 'gelb';
  return 'rot';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp size={12} className="text-green-500" />;
  if (trend === 'fallend') return <TrendingDown size={12} className="text-red-500" />;
  return <Minus size={12} className="text-gray-400" />;
}

const MOCK: ApiData = {
  drivers: [
    { driver_id: 'd1', driver_name: 'Max M.', score: 94, pünktlichkeit: 96, effizienz: 91, kundenzufriedenheit: 95, touren_heute: 7, trend: 'steigend' },
    { driver_id: 'd2', driver_name: 'Sara K.', score: 88, pünktlichkeit: 90, effizienz: 85, kundenzufriedenheit: 89, touren_heute: 6, trend: 'stabil' },
    { driver_id: 'd3', driver_name: 'Tim B.', score: 74, pünktlichkeit: 72, effizienz: 78, kundenzufriedenheit: 72, touren_heute: 5, trend: 'fallend' },
    { driver_id: 'd4', driver_name: 'Julia F.', score: 61, pünktlichkeit: 58, effizienz: 65, kundenzufriedenheit: 60, touren_heute: 4, trend: 'fallend' },
  ],
  team_avg_score: 79.25,
  best_score: 94,
  best_driver: 'Max M.',
};

const SUB_LABELS: { key: keyof DriverScore; label: string }[] = [
  { key: 'pünktlichkeit', label: 'Pünktl.' },
  { key: 'effizienz', label: 'Effiz.' },
  { key: 'kundenzufriedenheit', label: 'Kunden' },
];

export function DispatchPhase2717TourScoreEchtzeitBoard({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    const load = () =>
      fetch(`/api/delivery/admin/tour-score-echtzeit?location_id=${locationId ?? ''}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));

    if (!locationId) { setData(MOCK); return; }
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (!data) return null;

  const sortedDrivers = [...data.drivers].sort((a, b) => b.score - a.score);
  const hasAlerts = data.drivers.some(d => d.score < 70 || d.trend === 'fallend');

  return (
    <div className={cn(
      'rounded-xl border shadow-sm mb-3 overflow-hidden',
      hasAlerts ? 'border-amber-200 bg-amber-50/30' : 'border-matcha-200 bg-white'
    )}>
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-matcha-50/60 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Trophy size={16} className="text-amber-500" />
          <span className="font-semibold text-sm text-gray-900">Tour-Score Echtzeit</span>
          {hasAlerts && (
            <span className="flex items-center gap-0.5 text-xs text-amber-700 font-medium bg-amber-100 rounded-full px-1.5 py-0.5">
              <AlertTriangle size={10} /> Handlungsbedarf
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-gray-500">Ø Team</span>
          <span className={cn(
            'font-bold text-sm',
            scoreFarbe(data.team_avg_score) === 'gruen' && 'text-green-600',
            scoreFarbe(data.team_avg_score) === 'gelb' && 'text-amber-600',
            scoreFarbe(data.team_avg_score) === 'rot' && 'text-red-600',
          )}>
            {data.team_avg_score.toFixed(0)}
          </span>
          <span className="text-gray-300">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-matcha-100">
          {/* Best driver banner */}
          <div className="px-4 py-2 bg-matcha-50 border-b border-matcha-100 flex items-center gap-2">
            <Star size={12} className="text-amber-400 fill-amber-400" />
            <span className="text-xs text-matcha-700 font-medium">
              Bester Fahrer: <strong>{data.best_driver}</strong> — {data.best_score} Punkte
            </span>
          </div>

          {/* Driver rows */}
          <div className="divide-y divide-gray-50">
            {sortedDrivers.map((driver, idx) => {
              const farbe = scoreFarbe(driver.score);
              return (
                <div key={driver.driver_id} className="px-4 py-3">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs text-gray-400 w-4">{idx + 1}.</span>
                    <span className="text-sm font-semibold text-gray-800 flex-1">{driver.driver_name}</span>
                    <div className="flex items-center gap-1.5">
                      <TrendIcon trend={driver.trend} />
                      <span className={cn(
                        'text-xl font-black tabular-nums',
                        farbe === 'gruen' && 'text-green-600',
                        farbe === 'gelb' && 'text-amber-600',
                        farbe === 'rot' && 'text-red-600',
                      )}>
                        {driver.score}
                      </span>
                    </div>
                  </div>

                  {/* Score bar */}
                  <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mb-2">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-700',
                        farbe === 'gruen' && 'bg-green-500',
                        farbe === 'gelb' && 'bg-amber-400',
                        farbe === 'rot' && 'bg-red-500',
                      )}
                      style={{ width: `${driver.score}%` }}
                    />
                  </div>

                  {/* Sub-scores */}
                  <div className="grid grid-cols-3 gap-1.5">
                    {SUB_LABELS.map(({ key, label }) => {
                      const val = driver[key] as number;
                      const sub = scoreFarbe(val);
                      return (
                        <div key={key} className="text-center">
                          <div className={cn(
                            'text-xs font-bold',
                            sub === 'gruen' && 'text-green-600',
                            sub === 'gelb' && 'text-amber-600',
                            sub === 'rot' && 'text-red-600',
                          )}>
                            {val}
                          </div>
                          <div className="text-[9px] text-gray-400">{label}</div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-1 mt-1.5">
                    <Route size={10} className="text-gray-400" />
                    <span className="text-[10px] text-gray-400">{driver.touren_heute} Touren heute</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
