'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_stunden: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_wenig: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_stunden: number;
  gesamt: number;
  ziel_stunden: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, avg_stunden: 7.5, rank_delta: 1, ampel: 'gruen', alert_wenig: false },
  ],
  team_avg_stunden: 5.93,
  gesamt: 4,
  ziel_stunden: 6,
};

interface Props {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase4303MeineSchichtstunden({ driverId, locationId, isOnline }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-schichtstunden-ranking?location_id=${locationId}`);
      if (res.ok) { const json = await res.json(); if (!json.error) setData(json); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 30 * 60 * 1000); return () => clearInterval(id); }, [load]);

  if (!isOnline) return null;

  const me = data.fahrer.find((f) => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!me) return null;

  const ampelColor = me.ampel === 'gruen' ? 'text-indigo-600' : me.ampel === 'gelb' ? 'text-yellow-600' : 'text-red-600';
  const ampelBg = me.ampel === 'gruen' ? 'bg-indigo-50' : me.ampel === 'gelb' ? 'bg-yellow-50' : 'bg-red-50';
  // STANDARD: rank_delta < 0 = rang verbessert = TrendingUp emerald
  const Delta = me.rank_delta < 0 ? TrendingUp : me.rank_delta > 0 ? TrendingDown : Minus;
  const dColor = me.rank_delta < 0 ? 'text-emerald-500' : me.rank_delta > 0 ? 'text-red-400' : 'text-gray-400';

  const coaching =
    me.ampel === 'gruen'
      ? 'Top! Du gehörst zu den fleißigsten Fahrern im Team.'
      : me.ampel === 'gelb'
      ? `Tipp: Versuche deine Schichten auf Ø ${data.ziel_stunden}h zu bringen.`
      : 'Achtung: Deine Schichtdauer liegt deutlich unter dem Teamdurchschnitt.';

  return (
    <div className={`rounded-2xl border p-4 space-y-3 ${ampelBg} border-gray-200`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-500" />
          <span className="text-sm font-semibold text-gray-900">Meine Schichtstunden</span>
        </div>
        {loading && <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
      </div>

      <div className="flex items-end gap-3">
        <span className={`text-5xl font-extrabold ${ampelColor}`}>{me.avg_stunden.toFixed(1)}h</span>
        <div className="pb-1 space-y-0.5">
          <span className="text-sm text-gray-500">Ø pro Schicht</span>
          <div className="flex items-center gap-1">
            <span className="text-2xl font-bold text-gray-700">#{me.rang}</span>
            <Delta className={`w-4 h-4 ${dColor}`} />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Team-Ø: <span className="font-semibold text-gray-700">{data.team_avg_stunden.toFixed(1)}h</span></span>
        <span>Ziel: <span className="font-semibold text-gray-700">{data.ziel_stunden}h</span></span>
        <span>{data.gesamt} Fahrer</span>
      </div>

      <div className="bg-white/70 rounded-lg px-3 py-2">
        <p className="text-xs text-gray-700">{coaching}</p>
      </div>
    </div>
  );
}
