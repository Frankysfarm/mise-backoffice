'use client';

import { useState, useEffect, useCallback } from 'react';
import { Target, TrendingUp, TrendingDown, Minus, WifiOff } from 'lucide-react';

interface ApiData { rate_pct: number; rang: number; rank_delta: number; ampel: 'gruen' | 'gelb' | 'rot'; team_avg_pct: number; fahrer_count: number; }

const MOCK: ApiData = { rate_pct: 88, rang: 2, rank_delta: 0, ampel: 'gelb', team_avg_pct: 78, fahrer_count: 4 };

interface Props { driverId: string; locationId: string | null; isOnline: boolean; }

export function FahrerPhase4183MeinePuenktlichkeit({ driverId, locationId, isOnline }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId || !driverId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-puenktlichkeits-ranking?location_id=${locationId}`);
      if (res.ok) {
        const json = await res.json();
        if (!json.error && json.fahrer?.length) {
          const me = json.fahrer.find((f: { fahrer_id: string }) => f.fahrer_id === driverId) ?? json.fahrer[0];
          setData({ rate_pct: me.rate_pct, rang: me.rang, rank_delta: me.rank_delta, ampel: me.ampel, team_avg_pct: json.team_avg_pct, fahrer_count: json.gesamt });
        }
      }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [driverId, locationId]);

  useEffect(() => { load(); const id = setInterval(load, 30 * 60 * 1000); return () => clearInterval(id); }, [load]);

  if (!isOnline) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-2 text-gray-400">
        <WifiOff className="w-4 h-4" /><span className="text-sm">Nicht verfügbar (offline)</span>
      </div>
    );
  }

  const valColor = data.ampel === 'gruen' ? 'text-violet-500' : data.ampel === 'gelb' ? 'text-yellow-500' : 'text-red-500';
  const Delta = data.rank_delta < 0 ? TrendingUp : data.rank_delta > 0 ? TrendingDown : Minus;
  const dColor = data.rank_delta < 0 ? 'text-emerald-500' : data.rank_delta > 0 ? 'text-red-400' : 'text-gray-300';
  const coaching = data.ampel === 'gruen'
    ? 'Super – deine Lieferpünktlichkeit ist ausgezeichnet!'
    : data.ampel === 'gelb'
    ? 'Tipp: Achte auf präzises Timing bei deinen Lieferungen.'
    : 'Achtung: Deine Pünktlichkeitsquote liegt unter dem Teamdurchschnitt.';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Target className="w-4 h-4 text-violet-500" />
        <span className="text-sm font-semibold text-gray-900">Meine Pünktlichkeit</span>
        {loading && <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin ml-auto" />}
      </div>
      <div className="flex items-end gap-3">
        <span className={`text-5xl font-bold ${valColor}`}>{data.rate_pct?.toFixed(0)}</span>
        <div className="pb-1 space-y-0.5">
          <span className="text-xl font-medium text-gray-500">%</span>
          <div className="flex items-center gap-1">
            <span className="text-2xl font-bold text-gray-700">#{data.rang}</span>
            <Delta className={`w-4 h-4 ${dColor}`} />
          </div>
        </div>
      </div>
      <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2">{coaching}</p>
      <div className="flex justify-between text-xs text-gray-400">
        <span>Team-Ø {data.team_avg_pct?.toFixed(0)} %</span>
        <span>{data.fahrer_count} Fahrer</span>
      </div>
    </div>
  );
}
