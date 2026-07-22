'use client';
import { useEffect, useState } from 'react';
import { Zap, TrendingDown, TrendingUp, Minus } from 'lucide-react';

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

function Delta({ v }: { v: number }) {
  if (v < 0) return <span className="flex items-center gap-0.5 text-green-600 text-xs"><TrendingDown size={10} />{v}s</span>;
  if (v > 0) return <span className="flex items-center gap-0.5 text-red-500 text-xs"><TrendingUp size={10} />+{v}s</span>;
  return <span className="flex items-center gap-0.5 text-gray-400 text-xs"><Minus size={10} />0</span>;
}

export function KitchenPhase3244ReaktionszeitTicker({ locationId }: { locationId?: string | null }) {
  const [data, setData]       = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const url = locationId
        ? `/api/delivery/admin/fahrer-reaktionszeit-ranking?location_id=${locationId}`
        : `/api/delivery/admin/fahrer-reaktionszeit-ranking`;
      const res = await fetch(url);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); const t = setInterval(load, 30 * 60 * 1000); return () => clearInterval(t); }, [locationId]);

  if (loading) return <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 animate-pulse h-32 bg-gray-50 dark:bg-gray-800/40" />;
  if (!data)   return null;

  const bester = data.fahrer[0] ?? null;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 shadow-sm space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Zap size={14} className="text-yellow-500" />
          <span className="font-semibold text-xs text-gray-800 dark:text-gray-100">Reaktionszeit-Ranking</span>
          {bester && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              — Bester: <span className="font-medium text-green-600 dark:text-green-400">{bester.fahrer_name}</span> {fmtSek(bester.avg_sek)}
            </span>
          )}
        </div>
        {data.alert_count > 0 && (
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
            {data.alert_count}× Lange Reaktionszeit!
          </span>
        )}
      </div>

      {/* Fahrerliste kompakt aufsteigend (Rang 1 = kürzeste = oben) */}
      <div className="space-y-1">
        {data.fahrer.map(f => (
          <div key={f.fahrer_id} className="flex items-center gap-1.5 text-xs">
            <span className={`w-4 font-bold text-right ${f.ampel === 'gruen' ? 'text-green-600' : f.ampel === 'gelb' ? 'text-yellow-500' : 'text-red-500'}`}>
              #{f.rang}
            </span>
            <span className="flex-1 truncate text-gray-700 dark:text-gray-200">{f.fahrer_name}</span>
            <span className={`font-semibold w-12 text-right ${f.ampel === 'gruen' ? 'text-green-600' : f.ampel === 'gelb' ? 'text-yellow-500' : 'text-red-500'}`}>
              {fmtSek(f.avg_sek)}
            </span>
            <Delta v={f.rank_delta} />
          </div>
        ))}
      </div>

      {/* Team-Ø */}
      <div className="text-xs text-gray-400 pt-1 border-t border-gray-100 dark:border-gray-700">
        Team-Ø Reaktion: <span className="font-medium text-gray-600 dark:text-gray-300">{fmtSek(data.team_avg_sek)}</span>
        &nbsp;· Ziel: unter 60s
      </div>
    </div>
  );
}
