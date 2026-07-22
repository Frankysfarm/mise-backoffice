'use client';
import { useEffect, useState } from 'react';
import { Clock, TrendingDown, TrendingUp, Minus } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_sek: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_sek: number;
  bester_name: string;
  alert_count: number;
}

function fmtSek(s: number): string {
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

// negativ=verbessert: v < 0 → grün
function Delta({ v }: { v: number }) {
  if (v < 0) return <span className="flex items-center gap-0.5 text-green-500 text-xs"><TrendingDown size={10} />{v}</span>;
  if (v > 0) return <span className="flex items-center gap-0.5 text-red-400 text-xs"><TrendingUp size={10} />+{v}</span>;
  return <span className="text-gray-400 text-xs flex items-center gap-0.5"><Minus size={10} />0</span>;
}

export function KitchenPhase3234ErstkontaktRankingTicker({ locationId }: { locationId: string | null }) {
  const [data, setData]       = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const url = locationId
        ? `/api/delivery/admin/fahrer-erstkontakt-ranking?location_id=${locationId}`
        : `/api/delivery/admin/fahrer-erstkontakt-ranking`;
      const res = await fetch(url);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); const t = setInterval(load, 30 * 60 * 1000); return () => clearInterval(t); }, [locationId]);

  if (loading) return <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 animate-pulse h-24 bg-gray-50 dark:bg-gray-800/40" />;
  if (!data)   return null;

  const best = data.fahrer[0];

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 shadow-sm space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-orange-500" />
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">Erstkontakt-Ranking</span>
          {best && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              #1 <span className="font-medium text-gray-700 dark:text-gray-200">{best.fahrer_name}</span> {fmtSek(best.avg_sek)}
            </span>
          )}
        </div>
        {data.alert_count > 0 && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-medium">
            {data.alert_count}× Langer Erstkontakt!
          </span>
        )}
      </div>

      {/* Kompakte Liste — aufsteigend */}
      <div className="space-y-1">
        {data.fahrer.map(f => (
          <div key={f.fahrer_id} className="flex items-center gap-1.5 text-xs">
            <span className="w-4 font-bold text-gray-400 text-right">#{f.rang}</span>
            <span
              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${f.ampel === 'gruen' ? 'bg-green-500' : f.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-500'}`}
            />
            <span className="flex-1 truncate font-medium text-gray-700 dark:text-gray-200">{f.fahrer_name}</span>
            <span className={`font-semibold w-10 text-right ${f.ampel === 'gruen' ? 'text-green-600' : f.ampel === 'gelb' ? 'text-yellow-500' : 'text-red-500'}`}>
              {fmtSek(f.avg_sek)}
            </span>
            <Delta v={f.rank_delta} />
          </div>
        ))}
      </div>

      {/* Team-Ø */}
      <div className="text-xs text-gray-400 border-t border-gray-100 dark:border-gray-700 pt-1">
        Team-Ø: <span className="font-medium text-blue-600 dark:text-blue-400">{fmtSek(data.team_avg_sek)}</span>
      </div>
    </div>
  );
}
