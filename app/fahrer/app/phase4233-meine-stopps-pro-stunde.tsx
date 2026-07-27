'use client';

import { useState, useEffect, useCallback } from 'react';
import { Activity, TrendingUp, TrendingDown, Minus, WifiOff } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  stopps_pro_stunde: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg: number;
  bester_name: string;
  langsamster_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'm1', fahrer_name: 'Julia F.', rang: 1, stopps_pro_stunde: 3.2, rank_delta: 0,  ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'm2', fahrer_name: 'Sara K.',  rang: 2, stopps_pro_stunde: 2.8, rank_delta: 1,  ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'm3', fahrer_name: 'Max M.',   rang: 3, stopps_pro_stunde: 2.1, rank_delta: -1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'm4', fahrer_name: 'Tim B.',   rang: 4, stopps_pro_stunde: 1.4, rank_delta: 0,  ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg: 2.38,
  bester_name: 'Julia F.',
  langsamster_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

interface Props { driverId: string; locationId: string | null; isOnline: boolean; }

export function FahrerPhase4233MeineStoppsProStunde({ driverId, locationId, isOnline }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-stopps-pro-stunde-ranking?location_id=${locationId}&driver_id=${driverId}`);
      if (res.ok) { const json = await res.json(); if (!json.error) setData(json); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId, driverId]);

  useEffect(() => { load(); const id = setInterval(load, 30 * 60 * 1000); return () => clearInterval(id); }, [load]);

  if (!isOnline) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3 text-gray-400">
        <WifiOff className="w-5 h-5" />
        <span className="text-sm">Stopps/h-Daten nur im aktiven Dienst verfügbar.</span>
      </div>
    );
  }

  const me = data.fahrer[0];
  if (!me) return null;

  const sphColor = me.ampel === 'gruen' ? 'text-teal-600' : me.ampel === 'gelb' ? 'text-yellow-500' : 'text-red-500';
  const Delta = me.rank_delta > 0 ? TrendingUp : me.rank_delta < 0 ? TrendingDown : Minus;
  const dColor = me.rank_delta > 0 ? 'text-emerald-500' : me.rank_delta < 0 ? 'text-red-400' : 'text-gray-300';
  const coaching =
    me.ampel === 'gruen' ? 'Sehr gut – du bist einer der schnellsten im Team!' :
    me.ampel === 'gelb'  ? 'Tipp: Optimiere deine Stopp-Reihenfolge für mehr Effizienz.' :
                           'Achtung: Deine Stopps-pro-Stunde liegt unter dem Teamdurchschnitt.';
  const coachingColor =
    me.ampel === 'gruen' ? 'bg-green-50 border-green-200 text-green-700' :
    me.ampel === 'gelb'  ? 'bg-yellow-50 border-yellow-200 text-yellow-700' :
                           'bg-red-50 border-red-200 text-red-700';

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-teal-500" />
          <span className="text-sm font-semibold text-gray-900">Meine Stopps / Stunde</span>
        </div>
        {loading && <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
      </div>

      <div className="flex items-end justify-center gap-3 py-2">
        <span className={`text-5xl font-black ${sphColor}`}>{me.stopps_pro_stunde}</span>
        <div className="flex flex-col items-start pb-1">
          <span className="text-xs text-gray-400">Stopps/h</span>
          <span className="text-2xl font-bold text-gray-500">#{me.rang}</span>
        </div>
        <Delta className={`w-5 h-5 mb-2 ${dColor}`} />
      </div>

      <div className="flex justify-between text-xs text-gray-500 px-1">
        <span>Team-Ø: {data.team_avg} Stopps/h</span>
        <span>von {data.gesamt} Fahrern</span>
      </div>

      <div className={`border rounded-lg px-3 py-2 text-xs ${coachingColor}`}>
        {coaching}
      </div>
    </div>
  );
}
