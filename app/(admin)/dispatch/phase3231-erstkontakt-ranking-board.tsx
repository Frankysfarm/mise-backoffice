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
  letzter_name: string;
  alert_count: number;
  gesamt: number;
}

function fmtSek(s: number): string {
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function AmpelDot({ ampel }: { ampel: string }) {
  const cls = ampel === 'gruen' ? 'bg-green-500' : ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-500';
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${cls}`} />;
}

// negativ=verbessert: v < 0 → grün
function Delta({ v }: { v: number }) {
  if (v < 0) return <span className="flex items-center gap-0.5 text-green-600 text-xs font-medium"><TrendingDown size={11} />{v}</span>;
  if (v > 0) return <span className="flex items-center gap-0.5 text-red-500 text-xs font-medium"><TrendingUp size={11} />+{v}</span>;
  return <span className="flex items-center gap-0.5 text-gray-400 text-xs"><Minus size={11} />0</span>;
}

export function DispatchPhase3231ErstkontaktRankingBoard({ locationId }: { locationId: string | null }) {
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

  if (loading) return <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 animate-pulse h-48 bg-gray-50 dark:bg-gray-800/40" />;
  if (!data)   return null;

  const maxSek = data.fahrer.length > 0 ? Math.max(...data.fahrer.map(f => f.avg_sek)) : 1;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 shadow-sm space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-orange-500" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">Erstkontakt-Zeit-Ranking</span>
        </div>
        {data.alert_count > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
            {data.alert_count}× Langer Erstkontakt!
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
          <div className="font-semibold text-blue-700 dark:text-blue-300">{fmtSek(data.team_avg_sek)}</div>
        </div>
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-2">
          <div className="text-gray-500 dark:text-gray-400">Letzter</div>
          <div className="font-semibold text-red-700 dark:text-red-400 truncate">{data.letzter_name}</div>
        </div>
      </div>

      {/* Ranking-Liste — aufsteigend Rang 1 = kürzeste Zeit */}
      <div className="space-y-2">
        {data.fahrer.map(f => (
          <div key={f.fahrer_id} className="flex items-center gap-2">
            <span className="w-5 text-xs font-bold text-gray-500 dark:text-gray-400 text-right">#{f.rang}</span>
            <AmpelDot ampel={f.ampel} />
            <span className="flex-1 text-xs font-medium text-gray-800 dark:text-gray-100 truncate">{f.fahrer_name}</span>
            <span className={`text-xs font-semibold w-12 text-right ${f.ampel === 'gruen' ? 'text-green-600' : f.ampel === 'gelb' ? 'text-yellow-500' : 'text-red-500'}`}>
              {fmtSek(f.avg_sek)}
            </span>
            <div className="w-20 h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${f.ampel === 'gruen' ? 'bg-green-500' : f.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-500'}`}
                style={{ width: `${Math.round((f.avg_sek / maxSek) * 100)}%` }}
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
