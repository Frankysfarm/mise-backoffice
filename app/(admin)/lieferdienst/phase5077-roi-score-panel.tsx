'use client';

import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FahrerRoi {
  fahrer_id: string;
  fahrer_name: string;
  roi_score: number;
  roi: number;
  einnahmen: number;
  gesamtkosten: number;
  rang: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  rank_delta: number;
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRoi[];
  team_avg_score: number;
  team_avg_roi: number;
  meister_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   roi_score: 82, roi: 2.05, einnahmen: 148, gesamtkosten: 72,  rang: 1, ampel: 'gruen', rank_delta:  1, alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Julia F.', roi_score: 71, roi: 1.78, einnahmen: 124, gesamtkosten: 70,  rang: 2, ampel: 'gruen', rank_delta:  0, alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  roi_score: 54, roi: 1.42, einnahmen:  98, gesamtkosten: 69,  rang: 3, ampel: 'gelb',  rank_delta: -1, alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   roi_score: 31, roi: 0.88, einnahmen:  72, gesamtkosten: 82,  rang: 4, ampel: 'rot',   rank_delta:  0, alert_niedrig: true  },
  ],
  team_avg_score: 60,
  team_avg_roi: 1.53,
  meister_name: 'Max M.',
  alert_count: 1,
  gesamt: 4,
};

function ScoreBar({ score, ampel }: { score: number; ampel: string }) {
  const color = ampel === 'gruen' ? 'bg-emerald-400' : ampel === 'gelb' ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="h-1 w-full bg-slate-700/50 rounded-full overflow-hidden">
      <div className={cn('h-full rounded-full transition-all duration-500', color)} style={{ width: `${score}%` }} />
    </div>
  );
}

export function LieferdienstPhase5077RoiScorePanel({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);

  useEffect(() => {
    if (!locationId) return;
    async function load() {
      try {
        const res = await fetch(`/api/delivery/admin/fahrer-roi-ranking?location_id=${locationId}`);
        if (res.ok) setData(await res.json());
      } catch { /* keep mock */ }
    }
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [locationId]);

  const teamAvgScore = data.team_avg_score;
  const teamAvgRoi = data.team_avg_roi;

  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/20">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">ROI-Score-Ranking</p>
            <p className="text-xs text-slate-400">Einnahmen ÷ Kosten · Heute</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-white">{teamAvgScore}</p>
          <p className="text-xs text-slate-500">Team-Ø · ROI {teamAvgRoi}×</p>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-slate-800/50 p-2">
          <p className="text-lg font-bold text-white">{data.gesamt}</p>
          <p className="text-xs text-slate-500">Fahrer</p>
        </div>
        <div className="rounded-lg bg-slate-800/50 p-2">
          <p className="text-lg font-bold text-emerald-400">{data.fahrer[0]?.roi_score ?? '–'}</p>
          <p className="text-xs text-slate-500">Bester Score</p>
        </div>
        <div className="rounded-lg bg-slate-800/50 p-2">
          <p className="text-lg font-bold text-red-400">{data.alert_count}</p>
          <p className="text-xs text-slate-500">Niedrig-Alerts</p>
        </div>
      </div>

      {/* Rangliste */}
      <div className="space-y-2">
        {data.fahrer.map((f, idx) => {
          const medalColors = ['text-yellow-400', 'text-slate-300', 'text-amber-600'];
          const medalBg = ['bg-yellow-400/10', 'bg-slate-400/10', 'bg-amber-600/10'];
          const mc = medalColors[idx] ?? 'text-slate-500';
          const mb = medalBg[idx] ?? '';
          return (
            <div key={f.fahrer_id} className="rounded-lg bg-slate-800/40 border border-white/5 p-2.5 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className={cn('w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0', mb, mc)}>
                  {idx + 1}
                </span>
                <span className="text-sm font-semibold text-white flex-1">{f.fahrer_name}</span>
                <div className="flex items-center gap-1.5">
                  {f.rank_delta > 0 && <TrendingUp className="h-3 w-3 text-emerald-400" />}
                  {f.rank_delta < 0 && <TrendingDown className="h-3 w-3 text-red-400" />}
                  <span className={cn(
                    'text-sm font-bold',
                    f.ampel === 'gruen' ? 'text-emerald-400' : f.ampel === 'gelb' ? 'text-amber-400' : 'text-red-400'
                  )}>{f.roi_score}</span>
                </div>
              </div>
              <ScoreBar score={f.roi_score} ampel={f.ampel} />
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>ROI {f.roi}×</span>
                <span>{f.einnahmen}€ Einnahmen</span>
                {f.alert_niedrig && (
                  <span className="flex items-center gap-1 text-red-400">
                    <AlertCircle className="h-3 w-3" />Optimierungsbedarf
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
