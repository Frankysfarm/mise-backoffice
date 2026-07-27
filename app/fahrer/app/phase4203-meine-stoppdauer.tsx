'use client';

import { useState, useEffect, useCallback } from 'react';
import { Timer, TrendingUp, TrendingDown, Minus, WifiOff } from 'lucide-react';

interface ApiData { avg_sec: number; rang: number; rank_delta: number; ampel: 'gruen' | 'gelb' | 'rot'; team_avg_sec: number; fahrer_count: number; }

const MOCK: ApiData = { avg_sec: 72, rang: 2, rank_delta: 0, ampel: 'gruen', team_avg_sec: 108, fahrer_count: 4 };

interface Props { driverId: string; locationId: string | null; isOnline: boolean; }

export function FahrerPhase4203MeineStoppdauer({ driverId, locationId, isOnline }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId || !driverId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-stoppdauer-ranking?location_id=${locationId}&driver_id=${driverId}`);
      if (res.ok) {
        const json = await res.json();
        if (!json.error && json.fahrer?.length) {
          const me = json.fahrer[0];
          setData({ avg_sec: me.avg_sec, rang: me.rang, rank_delta: me.rank_delta, ampel: me.ampel, team_avg_sec: json.team_avg_sec, fahrer_count: json.gesamt });
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

  const valColor = data.ampel === 'gruen' ? 'text-orange-500' : data.ampel === 'gelb' ? 'text-yellow-500' : 'text-red-500';
  const Delta = data.rank_delta < 0 ? TrendingUp : data.rank_delta > 0 ? TrendingDown : Minus;
  const dColor = data.rank_delta < 0 ? 'text-emerald-500' : data.rank_delta > 0 ? 'text-red-400' : 'text-gray-300';
  const coaching = data.ampel === 'gruen'
    ? 'Super – du erledigst deine Stopps sehr zügig und effizient!'
    : data.ampel === 'gelb'
    ? 'Tipp: Bereite Sendungen schon vor der Ankunft vor, um die Stoppdauer zu verkürzen.'
    : 'Achtung: Deine Stopp-Verweildauer liegt über dem Teamdurchschnitt.';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Timer className="w-4 h-4 text-orange-500" />
        <span className="text-sm font-semibold text-gray-900">Meine Stopp-Verweildauer</span>
        {loading && <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin ml-auto" />}
      </div>
      <div className="flex items-end gap-3">
        <span className={`text-5xl font-bold ${valColor}`}>{data.avg_sec}</span>
        <div className="pb-1 space-y-0.5">
          <span className="text-xl font-medium text-gray-500">s</span>
          <div className="flex items-center gap-1">
            <span className="text-2xl font-bold text-gray-700">#{data.rang}</span>
            <Delta className={`w-4 h-4 ${dColor}`} />
          </div>
        </div>
      </div>
      <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2">{coaching}</p>
      <div className="flex justify-between text-xs text-gray-400">
        <span>Team-Ø {data.team_avg_sec} s · Stoppdauer</span>
        <span>{data.fahrer_count} Fahrer</span>
      </div>
    </div>
  );
}
