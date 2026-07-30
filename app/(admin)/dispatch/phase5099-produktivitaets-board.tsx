'use client';

import { useEffect, useState } from 'react';
import { Zap, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

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
  generatedAt: string;
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'up') return <TrendingUp className="w-3 h-3 text-green-400" />;
  if (trend === 'down') return <TrendingDown className="w-3 h-3 text-red-400" />;
  return <Minus className="w-3 h-3 text-gray-400" />;
}

function scoreColor(score: number) {
  if (score >= 75) return 'text-emerald-300';
  if (score >= 50) return 'text-amber-400';
  return 'text-red-400';
}

function barColor(score: number) {
  if (score >= 75) return 'bg-emerald-400';
  if (score >= 50) return 'bg-amber-500';
  return 'bg-red-500';
}

export function DispatchPhase5099ProduktivitaetsBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    const url = locationId
      ? `/api/delivery/admin/fahrer-produktivitaets-rangliste?location_id=${locationId}`
      : '/api/delivery/admin/fahrer-produktivitaets-rangliste';
    const res = await fetch(url);
    if (res.ok) setData(await res.json());
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!data?.rangliste?.length) return null;

  const liste = data.rangliste;
  const bester = liste[0];
  const letzter = liste[liste.length - 1];
  const teamAvg = Math.round(liste.reduce((s, f) => s + f.gesamtscore, 0) / liste.length);
  const maxScore = bester.gesamtscore;
  const alerts = liste.filter(f => f.gesamtscore < 50).length;

  return (
    <div className="rounded-2xl border border-amber-700 bg-amber-950/40 overflow-hidden mb-4">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-amber-700/50 bg-amber-900/20">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-300" />
          <span className="text-sm font-semibold text-amber-200">Produktivitäts-Ranking — Heute</span>
        </div>
        {alerts > 0 && (
          <div className="flex items-center gap-1 text-xs text-red-400">
            <AlertTriangle className="w-3.5 h-3.5" />
            {alerts} Niedrig-Alert
          </div>
        )}
      </div>

      {/* KPI-Grid */}
      <div className="grid grid-cols-3 divide-x divide-amber-800/40 border-b border-amber-700/30">
        <div className="px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500 mb-0.5">Höchster Score</div>
          <div className="text-sm font-bold text-amber-300">{bester.gesamtscore}</div>
          <div className="text-[10px] text-gray-500 truncate">{bester.fahrer_name}</div>
        </div>
        <div className="px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500 mb-0.5">Team-Ø</div>
          <div className="text-sm font-bold text-amber-200">{teamAvg}</div>
          <div className="text-[10px] text-gray-500">Punkte</div>
        </div>
        <div className="px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500 mb-0.5">Niedrigster</div>
          <div className="text-sm font-bold text-gray-400">{letzter.gesamtscore}</div>
          <div className="text-[10px] text-gray-500 truncate">{letzter.fahrer_name}</div>
        </div>
      </div>

      {/* Ranking-Liste */}
      <div className="px-4 py-3 space-y-2.5">
        {liste.map((f) => (
          <div key={f.driver_id} className="flex items-center gap-2">
            <span className={`text-xs font-bold w-5 shrink-0 ${scoreColor(f.gesamtscore)}`}>#{f.rank}</span>
            <span className="text-xs text-gray-300 truncate flex-1">{f.fahrer_name}</span>
            <div className="w-20 h-1.5 rounded-full bg-gray-800 overflow-hidden shrink-0">
              <div
                className={`h-full rounded-full ${barColor(f.gesamtscore)}`}
                style={{ width: `${maxScore > 0 ? Math.round((f.gesamtscore / maxScore) * 100) : 0}%` }}
              />
            </div>
            <span className={`text-xs font-semibold w-8 text-right shrink-0 ${scoreColor(f.gesamtscore)}`}>
              {f.gesamtscore}
            </span>
            <TrendIcon trend={f.trend} />
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-amber-800/30 bg-amber-900/10">
        <div className="text-[10px] text-gray-500">
          Bester: <span className="text-amber-300 font-semibold">{bester.fahrer_name}</span> ·
          {bester.stopps_pro_h} Stopps/h · {bester.puenktlichkeit_pct}% pünktlich
        </div>
      </div>
    </div>
  );
}
