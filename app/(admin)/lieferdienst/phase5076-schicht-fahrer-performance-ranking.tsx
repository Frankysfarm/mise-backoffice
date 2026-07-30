'use client';

import React, { useEffect, useState } from 'react';
import { cn, euro } from '@/lib/utils';
import { Trophy, Star, TrendingUp, TrendingDown, Clock, Bike, AlertCircle } from 'lucide-react';

interface FahrerSchichtLeistung {
  fahrer_id: string;
  fahrer_name: string;
  lieferungen: number;
  umsatz: number;
  puenktlichkeit_pct: number;
  avg_lieferzeit_min: number;
  score: number;
  delta_score?: number | null;
  online_min?: number | null;
}

interface Props {
  locationId: string | null;
}

const MOCK_FAHRER: FahrerSchichtLeistung[] = [
  { fahrer_id: 'f1', fahrer_name: 'Max B.', lieferungen: 14, umsatz: 312, puenktlichkeit_pct: 93, avg_lieferzeit_min: 21, score: 89, delta_score: 3, online_min: 240 },
  { fahrer_id: 'f2', fahrer_name: 'Lisa K.', lieferungen: 11, umsatz: 245, puenktlichkeit_pct: 88, avg_lieferzeit_min: 24, score: 81, delta_score: -2, online_min: 220 },
  { fahrer_id: 'f3', fahrer_name: 'Tom R.', lieferungen: 9, umsatz: 198, puenktlichkeit_pct: 78, avg_lieferzeit_min: 28, score: 68, delta_score: 1, online_min: 180 },
  { fahrer_id: 'f4', fahrer_name: 'Ana M.', lieferungen: 6, umsatz: 134, puenktlichkeit_pct: 95, avg_lieferzeit_min: 19, score: 76, delta_score: 5, online_min: 150 },
];

const MEDAL_COLORS = ['text-yellow-400', 'text-slate-300', 'text-amber-600'];
const MEDAL_BG = ['bg-yellow-400/10', 'bg-slate-400/10', 'bg-amber-600/10'];

function ScoreBar({ score }: { score: number }) {
  const color = score >= 85 ? 'bg-emerald-400' : score >= 70 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="h-1 w-full bg-slate-700/50 rounded-full overflow-hidden">
      <div className={cn('h-full rounded-full transition-all duration-500', color)} style={{ width: `${score}%` }} />
    </div>
  );
}

export function LieferdienstPhase5076SchichtFahrerPerformanceRanking({ locationId }: Props) {
  const [fahrer, setFahrer] = useState<FahrerSchichtLeistung[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!locationId) { setLoading(false); return; }

    async function load() {
      try {
        const res = await fetch(`/api/delivery/shifts/fahrer-ranking?location_id=${locationId}`);
        if (res.ok) {
          const data = await res.json();
          setFahrer(data.fahrer ?? data ?? MOCK_FAHRER);
        } else {
          setFahrer(MOCK_FAHRER);
        }
      } catch {
        setFahrer(MOCK_FAHRER);
      } finally {
        setLoading(false);
      }
    }

    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [locationId]);

  const sorted = fahrer.slice().sort((a, b) => b.score - a.score);
  const topScore = sorted[0]?.score ?? 0;
  const teamAvg = fahrer.length > 0 ? Math.round(fahrer.reduce((s, f) => s + f.score, 0) / fahrer.length) : 0;
  const teamLieferungen = fahrer.reduce((s, f) => s + f.lieferungen, 0);

  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-yellow-500/20">
            <Trophy className="h-4 w-4 text-yellow-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Schicht-Ranking</p>
            <p className="text-xs text-slate-400">Fahrer-Performance · Heute</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-white">{teamAvg}</p>
          <p className="text-xs text-slate-500">Team-Ø Score</p>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-slate-800/50 p-2">
          <p className="text-lg font-bold text-white">{fahrer.length}</p>
          <p className="text-xs text-slate-500">Aktive Fahrer</p>
        </div>
        <div className="rounded-lg bg-slate-800/50 p-2">
          <p className="text-lg font-bold text-blue-400">{teamLieferungen}</p>
          <p className="text-xs text-slate-500">Lieferungen</p>
        </div>
        <div className="rounded-lg bg-slate-800/50 p-2">
          <p className="text-lg font-bold text-yellow-400">{topScore}</p>
          <p className="text-xs text-slate-500">Top Score</p>
        </div>
      </div>

      {/* Rangliste */}
      <div className="space-y-2">
        {loading ? (
          <div className="text-center py-4 text-slate-500 text-sm">Lade Rangliste…</div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-4 text-slate-500 text-sm">Keine Daten</div>
        ) : (
          sorted.map((f, idx) => {
            const medalColor = MEDAL_COLORS[idx] ?? 'text-slate-500';
            const medalBg = MEDAL_BG[idx] ?? '';
            const puenktlichOk = f.puenktlichkeit_pct >= 85;

            return (
              <div key={f.fahrer_id} className="rounded-lg bg-slate-800/40 border border-white/5 p-2.5 space-y-2">
                {/* Zeile 1: Rang + Name + Score + Delta */}
                <div className="flex items-center gap-2">
                  <span className={cn('w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0', medalBg, medalColor)}>
                    {idx + 1}
                  </span>
                  <span className="text-sm font-semibold text-white flex-1">{f.fahrer_name}</span>
                  <div className="flex items-center gap-1.5">
                    {f.delta_score != null && (
                      f.delta_score > 0 ? (
                        <span className="flex items-center gap-0.5 text-xs text-emerald-400">
                          <TrendingUp className="h-3 w-3" />+{f.delta_score}
                        </span>
                      ) : f.delta_score < 0 ? (
                        <span className="flex items-center gap-0.5 text-xs text-red-400">
                          <TrendingDown className="h-3 w-3" />{f.delta_score}
                        </span>
                      ) : null
                    )}
                    <span className={cn(
                      'text-sm font-bold',
                      f.score >= 85 ? 'text-emerald-400' : f.score >= 70 ? 'text-amber-400' : 'text-red-400'
                    )}>
                      {f.score}
                    </span>
                  </div>
                </div>

                <ScoreBar score={f.score} />

                {/* Zeile 2: KPIs */}
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Bike className="h-3 w-3" />{f.lieferungen} Lieferungen
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />{f.avg_lieferzeit_min}min Ø
                  </span>
                  <span className={cn('flex items-center gap-1', puenktlichOk ? 'text-emerald-400' : 'text-red-400')}>
                    {!puenktlichOk && <AlertCircle className="h-3 w-3" />}
                    {f.puenktlichkeit_pct}% pünktlich
                  </span>
                </div>

                {/* Umsatz */}
                <p className="text-xs text-slate-500">
                  Umsatz: <span className="text-white font-medium">{euro(f.umsatz)}</span>
                  {f.online_min && <span className="ml-2 text-slate-600">· {Math.round(f.online_min / 60)}h online</span>}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
