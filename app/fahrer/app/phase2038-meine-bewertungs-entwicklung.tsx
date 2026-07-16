'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Star, ChevronDown, ChevronUp, Lightbulb, TrendingUp, TrendingDown, Minus } from 'lucide-react';

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
}

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

const MOCK_EIGENE: FahrerBewertungsTrend = {
  driver_id: 'self',
  name: 'Ich',
  avg_bewertung: 4.6,
  bewertungs_count: 35,
  trend: 'steigend',
  trend_delta: 0.2,
  alert_niedrig: false,
};
const MOCK_TEAM_AVG = 4.2;

const TIPPS: Record<string, string> = {
  steigend: 'Super — deine Bewertungen steigen! Weiter so mit deinem freundlichen Auftreten.',
  stabil: 'Deine Bewertungen sind stabil. Kleine Extras wie ein Lächeln können den Unterschied machen.',
  fallend: 'Deine Bewertungen sind zuletzt gesunken. Achte auf Pünktlichkeit und Freundlichkeit.',
};

const POLL_MS = 30 * 60 * 1000;

function starColor(rating: number) {
  if (rating >= 4.5) return 'text-green-400';
  if (rating >= 3.5) return 'text-amber-400';
  return 'text-red-400';
}

export function FahrerPhase2038MeineBewertungsEntwicklung({ driverId, locationId, isOnline }: Props) {
  const [open, setOpen] = useState(true);
  const [eigene, setEigene] = useState<FahrerBewertungsTrend | null>(null);
  const [teamAvg, setTeamAvg] = useState<number | null>(null);

  useEffect(() => {
    if (!driverId || !locationId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/fahrer-bewertungs-trend?location_id=${locationId}`);
        if (!res.ok) throw new Error();
        const json: BewertungsData = await res.json();
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

  const vsTeam = Math.round((e.avg_bewertung - tAvg) * 10) / 10;

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-100 hover:bg-gray-800 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Star className="w-4 h-4 text-yellow-400" />
          Meine Bewertungs-Entwicklung
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-gray-800 px-3 py-2 text-center">
              <div className={cn('text-xl font-bold', starColor(e.avg_bewertung))}>★ {e.avg_bewertung.toFixed(1)}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">Mein Ø</div>
            </div>
            <div className="rounded-lg bg-gray-800 px-3 py-2 text-center">
              <div className="text-xl font-bold text-gray-200">{e.bewertungs_count}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">Bewertungen</div>
            </div>
            <div className="rounded-lg bg-gray-800 px-3 py-2 text-center">
              <div className={cn('text-xl font-bold flex items-center justify-center gap-1',
                vsTeam > 0 ? 'text-green-400' : vsTeam < 0 ? 'text-red-400' : 'text-gray-400'
              )}>
                {vsTeam > 0 && <TrendingUp className="w-4 h-4" />}
                {vsTeam < 0 && <TrendingDown className="w-4 h-4" />}
                {vsTeam === 0 && <Minus className="w-4 h-4" />}
                {vsTeam > 0 ? '+' : ''}{vsTeam.toFixed(1)}
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">vs. Team</div>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-gray-400 px-1">
            <span>Trend letzte 30 Tage</span>
            <span className={cn('flex items-center gap-1',
              e.trend === 'steigend' ? 'text-green-400' : e.trend === 'fallend' ? 'text-red-400' : 'text-gray-400'
            )}>
              {e.trend === 'steigend' && <><TrendingUp className="w-3 h-3" /> +{e.trend_delta.toFixed(1)}</>}
              {e.trend === 'fallend' && <><TrendingDown className="w-3 h-3" /> {e.trend_delta.toFixed(1)}</>}
              {e.trend === 'stabil' && <><Minus className="w-3 h-3" /> stabil</>}
            </span>
          </div>

          <div className="flex gap-2 rounded-lg bg-yellow-950 border border-yellow-800 px-3 py-2 text-xs text-yellow-300">
            <Lightbulb className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>{TIPPS[e.trend] ?? TIPPS.stabil}</span>
          </div>
        </div>
      )}
    </div>
  );
}
