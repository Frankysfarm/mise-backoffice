'use client';

import { useState, useEffect, useCallback } from 'react';
import { AlertOctagon, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  verlust_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_top: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_verlust_pct: number;
  gesamt: number;
  ziel_pct: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, verlust_pct:  0.5, rank_delta:  0, ampel: 'gruen', alert_top: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, verlust_pct:  1.2, rank_delta:  1, ampel: 'gruen', alert_top: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, verlust_pct:  2.8, rank_delta: -1, ampel: 'gelb',  alert_top: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, verlust_pct:  5.5, rank_delta:  0, ampel: 'rot',   alert_top: true  },
  ],
  team_avg_verlust_pct: 2.5,
  gesamt: 4,
  ziel_pct: 1.0,
};

const COACHING: Record<string, string> = {
  gruen: 'Super! Deine Verlustquote ist ausgezeichnet. Weiter so!',
  gelb:  'Achte beim Übergeben auf sichere Ablage und Unterschrift.',
  rot:   'Hohe Verlustquote! Bitte jeden Stopp sorgfältig dokumentieren.',
};

interface Props {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase4018MeinPaketverlust({ driverId, locationId, isOnline }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId || !isOnline) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/delivery/admin/fahrer-paketverlust-ranking?location_id=${locationId}&driver_id=${driverId}`
      );
      if (res.ok) setData(await res.json());
    } catch {
      // Mock-Fallback
    } finally {
      setLoading(false);
    }
  }, [driverId, locationId, isOnline]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!isOnline) return null;

  const me = data.fahrer.find(f => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!me) return null;

  const maxPct = Math.max(...data.fahrer.map(f => f.verlust_pct), 1);
  const rangBalken = data.gesamt > 1 ? Math.round(((data.gesamt - me.rang) / (data.gesamt - 1)) * 100) : 100;
  const zielBalken = Math.min(Math.round((me.verlust_pct / (data.ziel_pct * 3)) * 100), 100);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <AlertOctagon className="w-5 h-5 text-red-500" />
        <span className="text-sm font-semibold text-gray-900">Mein Paketverlust</span>
        {loading && <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin ml-auto" />}
      </div>

      {/* Hauptwert */}
      <div className="text-center py-2">
        <div className={`text-5xl font-black ${
          me.ampel === 'gruen' ? 'text-emerald-600' :
          me.ampel === 'gelb'  ? 'text-amber-500'  : 'text-red-600'
        }`}>
          {me.verlust_pct}%
        </div>
        <div className="flex items-center justify-center gap-2 mt-1">
          <span className="text-2xl font-bold text-gray-700">#{me.rang}</span>
          {me.rank_delta < 0 ? (
            <TrendingUp className="w-5 h-5 text-emerald-500" />
          ) : me.rank_delta > 0 ? (
            <TrendingDown className="w-5 h-5 text-red-400" />
          ) : (
            <Minus className="w-4 h-4 text-gray-400" />
          )}
          <span className="text-xs text-gray-500">von {data.gesamt}</span>
        </div>
      </div>

      {/* Rang-Balken */}
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Schlechtester</span>
          <span>Bester</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${
              me.ampel === 'gruen' ? 'bg-emerald-500' :
              me.ampel === 'gelb'  ? 'bg-amber-400'  : 'bg-red-500'
            }`}
            style={{ width: `${rangBalken}%` }}
          />
        </div>
      </div>

      {/* Ziel-Balken */}
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Verlustquote</span>
          <span className="font-medium">Ziel ≤{data.ziel_pct}%</span>
        </div>
        <div className="relative w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${me.verlust_pct <= data.ziel_pct ? 'bg-emerald-500' : 'bg-red-500'}`}
            style={{ width: `${zielBalken}%` }}
          />
          {/* Ziel-Marker bei 33% (= ziel_pct / (ziel_pct*3)) */}
          <div className="absolute top-0 bottom-0 w-0.5 bg-emerald-600" style={{ left: '33%' }} />
        </div>
      </div>

      {/* Team-Avg */}
      <div className="flex justify-between text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
        <span>Team-Durchschnitt</span>
        <span className="font-semibold text-gray-700">{data.team_avg_verlust_pct}%</span>
      </div>

      {/* Coaching-Tipp */}
      <div className={`rounded-lg px-3 py-2 text-xs ${
        me.ampel === 'gruen' ? 'bg-emerald-50 text-emerald-700' :
        me.ampel === 'gelb'  ? 'bg-amber-50 text-amber-700'    : 'bg-red-50 text-red-700'
      }`}>
        {COACHING[me.ampel]}
      </div>

      {/* Mini-Ranking */}
      <div className="space-y-1">
        {data.fahrer.map((f) => {
          const barW = maxPct > 0 ? Math.round((f.verlust_pct / maxPct) * 100) : 0;
          const isMe = f.fahrer_id === driverId;
          return (
            <div
              key={f.fahrer_id}
              className={`flex items-center gap-2 rounded-lg px-2 py-1 ${isMe ? 'bg-red-50 border border-red-200' : ''}`}
            >
              <span className="text-xs text-gray-500 w-4 text-right">{f.rang}</span>
              <span className={`text-xs flex-1 truncate ${isMe ? 'font-bold text-gray-900' : 'text-gray-600'}`}>
                {f.fahrer_name}
              </span>
              <div className="w-16 bg-gray-200 rounded-full h-1">
                <div
                  className={`h-1 rounded-full ${
                    f.ampel === 'gruen' ? 'bg-emerald-500' :
                    f.ampel === 'gelb'  ? 'bg-amber-400'  : 'bg-red-500'
                  }`}
                  style={{ width: `${barW}%` }}
                />
              </div>
              <span className="text-xs text-gray-600 w-8 text-right">{f.verlust_pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
