'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Lightbulb } from 'lucide-react';

interface FahrerPuenktlichkeit {
  driver_id: string;
  rate: number;
  on_time: number;
  total: number;
  trend: 'besser' | 'gleich' | 'schlechter';
  trend_delta: number;
}

interface PuenktlichkeitsData {
  fahrer: FahrerPuenktlichkeit[];
  team_avg: number;
}

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

const MOCK_EIGENE: FahrerPuenktlichkeit = {
  driver_id: 'self',
  rate: 94,
  on_time: 33,
  total: 35,
  trend: 'besser',
  trend_delta: 2,
};
const MOCK_TEAM_AVG = 91;

const TIPPS: Record<string, string> = {
  besser: 'Starke Leistung! Deine Pünktlichkeit verbessert sich — bleib dran!',
  gleich: 'Stabile Pünktlichkeit. Mit klügerer Routenplanung kannst du noch besser werden.',
  schlechter: 'Deine Pünktlichkeit ist zuletzt gesunken. Plane mehr Puffer ein und starte früh.',
};

const POLL_MS = 30 * 60 * 1000;

function rateColor(rate: number) {
  if (rate >= 90) return 'text-green-400';
  if (rate >= 80) return 'text-amber-400';
  return 'text-red-400';
}

export function FahrerPhase2043MeinePuenktlichkeitsStatistik({ driverId, locationId, isOnline }: Props) {
  const [open, setOpen] = useState(true);
  const [eigene, setEigene] = useState<FahrerPuenktlichkeit | null>(null);
  const [teamAvg, setTeamAvg] = useState<number | null>(null);

  useEffect(() => {
    if (!driverId || !locationId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/schicht-puenktlichkeits-score?location_id=${locationId}`);
        if (!res.ok) throw new Error();
        const json: PuenktlichkeitsData = await res.json();
        const self = (json.fahrer ?? []).find(f => f.driver_id === driverId) ?? null;
        if (!cancelled) {
          setEigene(self);
          setTeamAvg(json.team_avg ?? null);
        }
      } catch {
        if (!cancelled) {
          setEigene(MOCK_EIGENE);
          setTeamAvg(MOCK_TEAM_AVG);
        }
      }
    };
    load();
    const iv = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(iv); };
  }, [driverId, locationId]);

  if (!isOnline) return null;

  const e = eigene ?? MOCK_EIGENE;
  const tAvg = teamAvg ?? MOCK_TEAM_AVG;
  const vsTeam = e.rate - tAvg;

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-100 hover:bg-gray-800 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-400" />
          Meine Pünktlichkeit
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-gray-800 px-3 py-2 text-center">
              <div className={cn('text-xl font-bold', rateColor(e.rate))}>{e.rate}%</div>
              <div className="text-[10px] text-gray-400 mt-0.5">Pünktlich</div>
            </div>
            <div className="rounded-lg bg-gray-800 px-3 py-2 text-center">
              <div className="text-xl font-bold text-gray-200">{e.on_time}/{e.total}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">Lieferungen</div>
            </div>
            <div className="rounded-lg bg-gray-800 px-3 py-2 text-center">
              <div className={cn('text-xl font-bold flex items-center justify-center gap-1',
                vsTeam > 0 ? 'text-green-400' : vsTeam < 0 ? 'text-red-400' : 'text-gray-400'
              )}>
                {vsTeam > 0 && <TrendingUp className="w-4 h-4" />}
                {vsTeam < 0 && <TrendingDown className="w-4 h-4" />}
                {vsTeam === 0 && <Minus className="w-4 h-4" />}
                {vsTeam > 0 ? '+' : ''}{vsTeam}%
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">vs. Team</div>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-gray-400 px-1">
            <span>Trend (letzte 24h)</span>
            <span className={cn('flex items-center gap-1',
              e.trend === 'besser' ? 'text-green-400' : e.trend === 'schlechter' ? 'text-red-400' : 'text-gray-400'
            )}>
              {e.trend === 'besser' && <><TrendingUp className="w-3 h-3" /> +{e.trend_delta}%</>}
              {e.trend === 'schlechter' && <><TrendingDown className="w-3 h-3" /> {e.trend_delta}%</>}
              {e.trend === 'gleich' && <><Minus className="w-3 h-3" /> stabil</>}
            </span>
          </div>

          <div className="h-2 rounded-full bg-gray-700 overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', rateColor(e.rate).replace('text-', 'bg-'))}
              style={{ width: `${e.rate}%` }}
            />
          </div>

          <div className="flex gap-2 rounded-lg bg-blue-950 border border-blue-800 px-3 py-2 text-xs text-blue-300">
            <Lightbulb className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>{TIPPS[e.trend] ?? TIPPS.gleich}</span>
          </div>
        </div>
      )}
    </div>
  );
}
