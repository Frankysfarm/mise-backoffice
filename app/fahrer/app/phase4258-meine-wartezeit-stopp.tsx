'use client';

import { useState, useEffect, useCallback } from 'react';
import { Timer, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  wartezeit_min: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_top: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg: number;
  gesamt: number;
}

const MOCK_ALL: FahrerRow[] = [
  { fahrer_id: 'p1', fahrer_name: 'Julia F.', rang: 1, wartezeit_min: 2.1, rank_delta:  0, ampel: 'gruen', alert_top: false },
  { fahrer_id: 'p2', fahrer_name: 'Sara K.',  rang: 2, wartezeit_min: 3.5, rank_delta:  1, ampel: 'gruen', alert_top: false },
  { fahrer_id: 'p3', fahrer_name: 'Max M.',   rang: 3, wartezeit_min: 5.2, rank_delta: -1, ampel: 'gelb',  alert_top: false },
  { fahrer_id: 'p4', fahrer_name: 'Tim B.',   rang: 4, wartezeit_min: 8.1, rank_delta:  0, ampel: 'rot',   alert_top: true  },
];

const MOCK: ApiData = {
  fahrer: MOCK_ALL,
  team_avg: 4.7,
  gesamt: 4,
};

interface Props {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase4258MeineWartezeitStopp({ driverId, locationId, isOnline }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/delivery/admin/fahrer-wartezeit-stopp-ranking?location_id=${locationId}&driver_id=${driverId}`
      );
      if (res.ok) { const json = await res.json(); if (!json.error) setData(json); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId, driverId]);

  useEffect(() => { load(); const id = setInterval(load, 30 * 60 * 1000); return () => clearInterval(id); }, [load]);

  if (!isOnline) return null;

  const me = data.fahrer[0];
  if (!me) return null;

  const ampelColor = me.ampel === 'gruen' ? 'text-emerald-600' : me.ampel === 'gelb' ? 'text-yellow-600' : 'text-red-600';
  const ampelBg = me.ampel === 'gruen' ? 'bg-emerald-50' : me.ampel === 'gelb' ? 'bg-yellow-50' : 'bg-red-50';
  const Delta = me.rank_delta > 0 ? TrendingUp : me.rank_delta < 0 ? TrendingDown : Minus;
  const dColor = me.rank_delta > 0 ? 'text-emerald-500' : me.rank_delta < 0 ? 'text-red-400' : 'text-gray-400';

  const coaching =
    me.ampel === 'gruen'
      ? 'Top! Deine Stopps werden sehr schnell abgearbeitet.'
      : me.ampel === 'gelb'
      ? 'Tipp: Zügigere Abarbeitung der Stopps spart Zeit.'
      : 'Achtung: Deine Wartezeit am Stopp liegt deutlich über dem Schnitt.';

  return (
    <div className={`rounded-2xl border p-4 space-y-3 ${ampelBg} border-gray-200`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Timer className="w-4 h-4 text-orange-500" />
          <span className="text-sm font-semibold text-gray-900">Wartezeit / Stopp</span>
        </div>
        {loading && <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
      </div>

      <div className="flex items-end gap-3">
        <span className={`text-5xl font-extrabold ${ampelColor}`}>{me.wartezeit_min}</span>
        <div className="pb-1 space-y-0.5">
          <span className="text-sm text-gray-500">min / Stopp</span>
          <div className="flex items-center gap-1">
            <span className="text-2xl font-bold text-gray-700">#{me.rang}</span>
            <Delta className={`w-4 h-4 ${dColor}`} />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Team-Ø: <span className="font-semibold text-gray-700">{data.team_avg} min</span></span>
        <span>{data.gesamt} Fahrer</span>
      </div>

      <div className="bg-white/70 rounded-lg px-3 py-2">
        <p className="text-xs text-gray-700">{coaching}</p>
      </div>
    </div>
  );
}
