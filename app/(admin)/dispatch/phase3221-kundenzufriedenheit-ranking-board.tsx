'use client';
import { useEffect, useState } from 'react';
import { Star, TrendingDown, TrendingUp, Minus } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  score: number;
  bewertungen: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_score: number;
  bester_name: string;
  niedrigster_name: string;
  alert_count: number;
  gesamt: number;
}

function Stars({ score }: { score: number }) {
  const full  = Math.floor(score);
  const half  = score - full >= 0.3 ? 1 : 0;
  const empty = 5 - full - half;
  return (
    <span className="flex gap-0.5 items-center">
      {Array.from({ length: full  }).map((_, i) => <Star key={`f${i}`} size={12} className="text-yellow-400 fill-yellow-400" />)}
      {half === 1 && <Star size={12} className="text-yellow-400 fill-yellow-200" />}
      {Array.from({ length: empty }).map((_, i) => <Star key={`e${i}`} size={12} className="text-gray-300" />)}
    </span>
  );
}

function AmpelDot({ ampel }: { ampel: string }) {
  const cls = ampel === 'gruen' ? 'bg-green-500' : ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-500';
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${cls}`} />;
}

function Delta({ v }: { v: number }) {
  if (v > 0) return <span className="flex items-center gap-0.5 text-green-600 text-xs font-medium"><TrendingUp size={11} />+{v}</span>;
  if (v < 0) return <span className="flex items-center gap-0.5 text-red-500 text-xs font-medium"><TrendingDown size={11} />{v}</span>;
  return <span className="flex items-center gap-0.5 text-gray-400 text-xs"><Minus size={11} />0</span>;
}

export function DispatchPhase3221KundenzufriedenheitRankingBoard({ locationId }: { locationId: string | null }) {
  const [data, setData]     = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const url = locationId
        ? `/api/delivery/admin/fahrer-kundenzufriedenheit-score?location_id=${locationId}`
        : `/api/delivery/admin/fahrer-kundenzufriedenheit-score`;
      const res = await fetch(url);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); const t = setInterval(load, 30 * 60 * 1000); return () => clearInterval(t); }, [locationId]);

  if (loading) return <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 animate-pulse h-48 bg-gray-50 dark:bg-gray-800/40" />;
  if (!data)   return null;

  const maxScore = 5;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 shadow-sm space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star size={16} className="text-yellow-400 fill-yellow-400" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">Kundenzufriedenheit-Ranking</span>
        </div>
        {data.alert_count > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
            {data.alert_count}× Niedrige Kundenzufriedenheit!
          </span>
        )}
      </div>

      {/* KPI-Grid */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-2">
          <div className="text-gray-500 dark:text-gray-400">Bester</div>
          <div className="font-semibold text-green-700 dark:text-green-400 truncate">{data.bester_name}</div>
        </div>
        <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-2">
          <div className="text-gray-500 dark:text-gray-400">Team-Ø</div>
          <div className="font-semibold text-blue-700 dark:text-blue-300">{data.team_avg_score.toFixed(1)} ★</div>
        </div>
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-2">
          <div className="text-gray-500 dark:text-gray-400">Niedrigster</div>
          <div className="font-semibold text-red-700 dark:text-red-400 truncate">{data.niedrigster_name}</div>
        </div>
      </div>

      {/* Ranking-Liste */}
      <div className="space-y-2">
        {data.fahrer.map(f => (
          <div key={f.fahrer_id} className="flex items-center gap-2">
            <span className="w-5 text-xs font-bold text-gray-500 dark:text-gray-400 text-right">#{f.rang}</span>
            <AmpelDot ampel={f.ampel} />
            <span className="flex-1 text-xs font-medium text-gray-800 dark:text-gray-100 truncate">{f.fahrer_name}</span>
            <Stars score={f.score} />
            <span className="text-xs text-gray-600 dark:text-gray-400 w-8 text-right">{f.score.toFixed(1)}</span>
            <div className="w-20 h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${f.ampel === 'gruen' ? 'bg-green-500' : f.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-500'}`}
                style={{ width: `${(f.score / maxScore) * 100}%` }}
              />
            </div>
            <Delta v={f.rank_delta} />
          </div>
        ))}
      </div>

      {/* Legende */}
      <div className="flex gap-3 text-xs text-gray-500 pt-1 border-t border-gray-100 dark:border-gray-700">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Top 25%</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />Mitte</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Bottom 25%</span>
      </div>
    </div>
  );
}
