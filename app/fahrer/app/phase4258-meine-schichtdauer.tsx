'use client';

import { useState, useEffect, useCallback } from 'react';
import { Timer, TrendingUp, TrendingDown, Minus, WifiOff } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  dauer_min: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_top: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg: number;
  gesamt: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, dauer_min: 480, rank_delta:  0, ampel: 'gruen', alert_top: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, dauer_min: 510, rank_delta: -1, ampel: 'gelb',  alert_top: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, dauer_min: 555, rank_delta:  1, ampel: 'gelb',  alert_top: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, dauer_min: 615, rank_delta:  0, ampel: 'rot',   alert_top: true  },
  ],
  team_avg: 540,
  gesamt: 4,
};

function fmtMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

interface Props { driverId: string; locationId: string | null; isOnline: boolean; }

export function FahrerPhase4258MeineSchichtdauer({ driverId, locationId, isOnline }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-schicht-dauer?location_id=${locationId}`);
      if (res.ok) { const json = await res.json(); if (!json.error) setData(json); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 30 * 60 * 1000); return () => clearInterval(id); }, [load]);

  if (!isOnline) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3 text-gray-400">
        <WifiOff className="w-5 h-5" />
        <span className="text-sm">Schichtdauer-Daten nur im aktiven Dienst verfügbar.</span>
      </div>
    );
  }

  const me = data.fahrer.find((f: { fahrer_id: string }) => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!me) return null;

  const durColor = me.ampel === 'gruen' ? 'text-cyan-600' : me.ampel === 'gelb' ? 'text-yellow-500' : 'text-red-500';
  const Delta = me.rank_delta < 0 ? TrendingUp : me.rank_delta > 0 ? TrendingDown : Minus;
  const dColor = me.rank_delta < 0 ? 'text-emerald-500' : me.rank_delta > 0 ? 'text-red-400' : 'text-gray-300';
  const coaching =
    me.ampel === 'gruen' ? 'Sehr gut – deine Schichtzeiten sind im Top-Bereich!' :
    me.ampel === 'gelb'  ? 'Tipp: Längere Verfügbarkeit erhöht deine Einsatzchancen.' :
                           'Achtung: Deine Schichtdauer liegt deutlich unter dem Teamdurchschnitt.';
  const coachingColor =
    me.ampel === 'gruen' ? 'bg-green-50 border-green-200 text-green-700' :
    me.ampel === 'gelb'  ? 'bg-yellow-50 border-yellow-200 text-yellow-700' :
                           'bg-red-50 border-red-200 text-red-700';

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Timer className="w-4 h-4 text-cyan-500" />
          <span className="text-sm font-semibold text-gray-900">Meine Schichtdauer</span>
        </div>
        {loading && <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
      </div>

      <div className="flex items-end justify-center gap-3 py-2">
        <span className={`text-5xl font-black ${durColor}`}>{fmtMin(me.dauer_min)}</span>
        <div className="flex flex-col items-start pb-1">
          <span className="text-xs text-gray-400">Schicht</span>
          <span className="text-2xl font-bold text-gray-500">#{me.rang}</span>
        </div>
        <Delta className={`w-5 h-5 mb-2 ${dColor}`} />
      </div>

      <div className="flex justify-between text-xs text-gray-500 px-1">
        <span>Team-Ø: {fmtMin(data.team_avg)}</span>
        <span>von {data.gesamt} Fahrern</span>
      </div>

      <div className={`border rounded-lg px-3 py-2 text-xs ${coachingColor}`}>
        {coaching}
      </div>
    </div>
  );
}
