'use client';

import { useState, useEffect, useCallback } from 'react';
import { Timer, TrendingUp, TrendingDown, Minus, WifiOff } from 'lucide-react';

interface ApiData { avg_min: number; rang: number; rank_delta: number; ampel: 'gruen' | 'gelb' | 'rot'; team_avg_min: number; gesamt: number; ziel_min: number; }

const MOCK: ApiData = { avg_min: 4, rang: 2, rank_delta: -1, ampel: 'gruen', team_avg_min: 5, gesamt: 4, ziel_min: 5 };

interface Props { driverId: string; locationId: string | null; isOnline: boolean; }

export function FahrerPhase4108MeineReaktionszeit({ driverId, locationId, isOnline }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!driverId || !locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-reaktionszeit-ranking?location_id=${locationId}&driver_id=${driverId}`);
      if (res.ok) {
        const json = await res.json();
        if (!json.error && json.fahrer) {
          const me = json.fahrer.find((f: { fahrer_id: string }) => f.fahrer_id === driverId) ?? json.fahrer[0];
          if (me) setData({ avg_min: me.avg_min, rang: me.rang, rank_delta: me.rank_delta, ampel: me.ampel, team_avg_min: json.team_avg_min, gesamt: json.gesamt, ziel_min: json.ziel_min });
        }
      }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [driverId, locationId]);

  useEffect(() => { load(); const id = setInterval(load, 30 * 60 * 1000); return () => clearInterval(id); }, [load]);

  if (!isOnline) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-2 text-gray-400">
        <WifiOff className="w-4 h-4" />
        <span className="text-xs">Reaktionszeit-Ranking nicht verfügbar (offline)</span>
      </div>
    );
  }

  const valueColor = data.ampel === 'gruen' ? 'text-emerald-600' : data.ampel === 'gelb' ? 'text-yellow-500' : 'text-red-500';
  const coaching = data.avg_min <= data.ziel_min
    ? 'Sehr gut – deine Reaktionszeit liegt unter dem Ziel!'
    : data.ampel === 'gelb'
    ? `Tipp: Versuche, Aufträge in unter ${data.ziel_min} Minuten anzunehmen.`
    : `Achtung: Deine Reaktionszeit liegt deutlich über dem Ziel von ${data.ziel_min} Minuten.`;
  const DeltaIcon = data.rank_delta < 0 ? <TrendingUp className="w-4 h-4 text-emerald-500" /> : data.rank_delta > 0 ? <TrendingDown className="w-4 h-4 text-red-400" /> : <Minus className="w-4 h-4 text-gray-300" />;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Timer className="w-4 h-4 text-cyan-500" />
          <span className="text-sm font-semibold text-gray-900">Meine Reaktionszeit</span>
        </div>
        {loading && <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
      </div>
      <div className="flex items-end gap-3">
        <span className={`text-5xl font-bold tabular-nums ${valueColor}`}>{data.avg_min}</span>
        <div className="flex flex-col items-start pb-1">
          <span className="text-2xl font-semibold text-gray-500">min</span>
          <div className="flex items-center gap-1">
            {DeltaIcon}
            <span className={`text-2xl font-semibold ${valueColor}`}>#{data.rang}</span>
          </div>
          <span className="text-[10px] text-gray-400">von {data.gesamt} Fahrern</span>
        </div>
      </div>
      <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2">{coaching}</div>
      <div className="flex justify-between text-[11px] text-gray-400 px-1">
        <span>Team-Ø {data.team_avg_min} min · Ziel &lt;{data.ziel_min} min</span>
        <span>Rang 1 = schnellste Reaktion</span>
      </div>
    </div>
  );
}
