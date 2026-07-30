'use client';

import React, { useEffect, useState } from 'react';
import { Zap, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FahrerRang {
  rank: number;
  driver_id: string;
  fahrer_name: string;
  gesamtscore: number;
  stopps_pro_h: number;
  puenktlichkeit_pct: number;
  bewertung_avg: number;
  trend: 'up' | 'down' | 'gleich';
  gestern_score: number | null;
}

interface ApiResponse {
  rangliste: FahrerRang[];
}

const MOCK: FahrerRang[] = [
  { rank: 1, driver_id: 'f1', fahrer_name: 'Max M.',   gesamtscore: 88, stopps_pro_h: 4.2, puenktlichkeit_pct: 94, bewertung_avg: 4.7, trend: 'up',    gestern_score: 85 },
  { rank: 2, driver_id: 'f2', fahrer_name: 'Julia F.', gesamtscore: 76, stopps_pro_h: 3.8, puenktlichkeit_pct: 89, bewertung_avg: 4.5, trend: 'gleich', gestern_score: 76 },
  { rank: 3, driver_id: 'f3', fahrer_name: 'Sara K.',  gesamtscore: 61, stopps_pro_h: 3.1, puenktlichkeit_pct: 80, bewertung_avg: 4.2, trend: 'down',   gestern_score: 67 },
  { rank: 4, driver_id: 'f4', fahrer_name: 'Tim B.',   gesamtscore: 44, stopps_pro_h: 2.4, puenktlichkeit_pct: 72, bewertung_avg: 3.9, trend: 'up',    gestern_score: 40 },
];

function ScoreBar({ score }: { score: number }) {
  const color = score >= 75 ? 'bg-emerald-400' : score >= 50 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="h-1 w-full bg-slate-700/50 rounded-full overflow-hidden">
      <div className={cn('h-full rounded-full transition-all duration-500', color)} style={{ width: `${score}%` }} />
    </div>
  );
}

export function LieferdienstPhase5078ProduktivitaetsPanel({ locationId }: { locationId: string | null }) {
  const [liste, setListe] = useState<FahrerRang[]>(MOCK);

  useEffect(() => {
    if (!locationId) return;
    async function load() {
      try {
        const res = await fetch(`/api/delivery/admin/fahrer-produktivitaets-rangliste?location_id=${locationId}`);
        if (res.ok) {
          const data: ApiResponse = await res.json();
          if (data.rangliste?.length) setListe(data.rangliste);
        }
      } catch { /* keep mock */ }
    }
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [locationId]);

  const teamAvg = Math.round(liste.reduce((s, f) => s + f.gesamtscore, 0) / (liste.length || 1));
  const topScore = liste[0]?.gesamtscore ?? 0;
  const alerts = liste.filter(f => f.gesamtscore < 50).length;

  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/20">
            <Zap className="h-4 w-4 text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Produktivitäts-Ranking</p>
            <p className="text-xs text-slate-400">Pünktlichkeit + Stopps/h + Bewertung · Heute</p>
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
          <p className="text-lg font-bold text-white">{liste.length}</p>
          <p className="text-xs text-slate-500">Fahrer</p>
        </div>
        <div className="rounded-lg bg-slate-800/50 p-2">
          <p className="text-lg font-bold text-amber-400">{topScore}</p>
          <p className="text-xs text-slate-500">Top Score</p>
        </div>
        <div className="rounded-lg bg-slate-800/50 p-2">
          <p className="text-lg font-bold text-red-400">{alerts}</p>
          <p className="text-xs text-slate-500">Niedrig-Alerts</p>
        </div>
      </div>

      {/* Rangliste */}
      <div className="space-y-2">
        {liste.map((f, idx) => {
          const medalColors = ['text-yellow-400', 'text-slate-300', 'text-amber-600'];
          const medalBg = ['bg-yellow-400/10', 'bg-slate-400/10', 'bg-amber-600/10'];
          return (
            <div key={f.driver_id} className="rounded-lg bg-slate-800/40 border border-white/5 p-2.5 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className={cn('w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                  medalBg[idx] ?? '', medalColors[idx] ?? 'text-slate-500')}>
                  {f.rank}
                </span>
                <span className="text-sm font-semibold text-white flex-1">{f.fahrer_name}</span>
                <div className="flex items-center gap-1.5">
                  {f.trend === 'up' && <TrendingUp className="h-3 w-3 text-emerald-400" />}
                  {f.trend === 'down' && <TrendingDown className="h-3 w-3 text-red-400" />}
                  <span className={cn('text-sm font-bold',
                    f.gesamtscore >= 75 ? 'text-emerald-400' : f.gesamtscore >= 50 ? 'text-amber-400' : 'text-red-400')}>
                    {f.gesamtscore}
                  </span>
                </div>
              </div>
              <ScoreBar score={f.gesamtscore} />
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>{f.stopps_pro_h} Stopps/h</span>
                <span>{f.puenktlichkeit_pct}% pünktlich</span>
                {f.gesamtscore < 50
                  ? <span className="flex items-center gap-1 text-red-400"><AlertCircle className="h-3 w-3" />Förderung</span>
                  : <span>⭐ {f.bewertung_avg}</span>
                }
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
