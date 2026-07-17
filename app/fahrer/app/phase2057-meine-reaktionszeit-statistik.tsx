'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Zap, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Lightbulb } from 'lucide-react';

interface FahrerReaktionszeit {
  driver_id: string;
  avg_min: number;
  auftraege: number;
  trend: 'besser' | 'gleich' | 'schlechter';
  trend_delta: number;
  alert: boolean;
}

interface ReaktionszeitData {
  fahrer: FahrerReaktionszeit[];
  team_avg_min: number;
}

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

const MOCK_EIGENE: FahrerReaktionszeit = {
  driver_id: 'self',
  avg_min: 4.2,
  auftraege: 11,
  trend: 'besser',
  trend_delta: -0.9,
  alert: false,
};
const MOCK_TEAM_AVG = 5.9;

const TIPPS: Record<string, string> = {
  besser: 'Stark! Deine Reaktionszeit verbessert sich — du bist schneller als das Team-Ø.',
  gleich: 'Stabile Reaktionszeit. Positioniere dich schon vorher am Restaurant für noch schnellere Abholung.',
  schlechter: 'Deine Reaktionszeit ist gestiegen. Bereite dich schon vor der Zuweisung am Restaurant vor.',
};

const POLL_MS = 30 * 60 * 1000;

function textColor(avg: number) {
  if (avg <= 5) return 'text-green-400';
  if (avg <= 10) return 'text-amber-400';
  return 'text-red-400';
}

function barWidth(avg: number, max = 15) {
  return Math.min((avg / max) * 100, 100);
}

export function FahrerPhase2057MeineReaktionsteitStatistik({ driverId, locationId, isOnline }: Props) {
  const [open, setOpen] = useState(true);
  const [eigene, setEigene] = useState<FahrerReaktionszeit | null>(null);
  const [teamAvg, setTeamAvg] = useState<number | null>(null);

  useEffect(() => {
    if (!driverId || !locationId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/fahrer-reaktionszeit?location_id=${locationId}`);
        if (!res.ok) throw new Error();
        const json: ReaktionszeitData = await res.json();
        if (!cancelled) {
          const mine = json.fahrer.find(f => f.driver_id === driverId) ?? null;
          setEigene(mine);
          setTeamAvg(json.team_avg_min);
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

  const f = eigene ?? MOCK_EIGENE;
  const avg = teamAvg ?? MOCK_TEAM_AVG;
  const delta = Math.round((f.avg_min - avg) * 10) / 10;

  return (
    <section className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-100"
      >
        <span className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-yellow-400" />
          Meine Reaktionszeit
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-gray-800 rounded-xl p-3 text-center">
              <div className={cn('text-xl font-black tabular-nums', textColor(f.avg_min))}>
                {f.avg_min}m
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">Ø Reaktion</div>
            </div>
            <div className="bg-gray-800 rounded-xl p-3 text-center">
              <div className="text-xl font-black tabular-nums text-blue-400">{f.auftraege}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">Aufträge</div>
            </div>
            <div className="bg-gray-800 rounded-xl p-3 text-center">
              <div className={cn('text-xl font-black tabular-nums', delta <= 0 ? 'text-green-400' : 'text-red-400')}>
                {delta > 0 ? '+' : ''}{delta}m
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">vs. Team</div>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs text-gray-400">
              <span>Reaktionszeit</span>
              <span className="flex items-center gap-1">
                {f.trend === 'besser' && <TrendingUp className="w-3 h-3 text-green-400" />}
                {f.trend === 'schlechter' && <TrendingDown className="w-3 h-3 text-red-400" />}
                {f.trend === 'gleich' && <Minus className="w-3 h-3 text-gray-400" />}
                {f.trend !== 'gleich' && (
                  <span className={f.trend === 'besser' ? 'text-green-400' : 'text-red-400'}>
                    {f.trend_delta > 0 ? '+' : ''}{f.trend_delta} Min
                  </span>
                )}
              </span>
            </div>
            <div className="h-2 rounded-full bg-gray-700 overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', textColor(f.avg_min).replace('text-', 'bg-'))}
                style={{ width: `${barWidth(f.avg_min)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-gray-500">
              <span>0 Min</span>
              <span>Team-Ø: {avg} Min</span>
              <span>15+ Min</span>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-gray-800 px-3 py-2 text-xs text-gray-300">
            <Lightbulb className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <span>{TIPPS[f.trend]}</span>
          </div>
        </div>
      )}
    </section>
  );
}
