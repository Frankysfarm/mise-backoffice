'use client';

import { useState, useEffect, useCallback } from 'react';
import { Target, TrendingUp, TrendingDown, Minus, WifiOff } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  quote_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_pct: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   rang: 1, quote_pct: 97, rank_delta:  2, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f2', fahrer_name: 'Julia F.', rang: 2, quote_pct: 89, rank_delta: -1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, quote_pct: 76, rank_delta:  1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, quote_pct: 52, rank_delta:  0, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg_pct: 78,
};

interface Props {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase3980MeineAbschlussquote({ driverId, locationId, isOnline }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-abschlussquoten-ranking?location_id=${locationId}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // Mock-Fallback
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!isOnline) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-2 text-gray-400 text-sm">
        <WifiOff className="w-4 h-4" />
        <span>Offline – Abschlussquote nicht verfügbar</span>
      </div>
    );
  }

  const me = data.fahrer.find(f => f.fahrer_id === driverId) ?? data.fahrer[0];
  const rateColor = me?.ampel === 'gruen' ? 'text-emerald-600' : me?.ampel === 'gelb' ? 'text-yellow-500' : 'text-red-500';
  const coaching =
    me?.ampel === 'gruen'
      ? 'Top – deine Abschlussquote ist ausgezeichnet!'
      : me?.ampel === 'gelb'
      ? 'Tipp: Schliesse mehr Lieferungen erfolgreich ab.'
      : 'Achtung: Deine Abschlussquote ist zu niedrig.';
  const coachingColor = me?.ampel === 'gruen' ? 'text-emerald-700 bg-emerald-50' : me?.ampel === 'gelb' ? 'text-yellow-700 bg-yellow-50' : 'text-red-700 bg-red-50';

  const DeltaIcon = (me?.rank_delta ?? 0) > 0
    ? <TrendingUp className="w-4 h-4 text-emerald-500" />
    : (me?.rank_delta ?? 0) < 0
      ? <TrendingDown className="w-4 h-4 text-red-400" />
      : <Minus className="w-4 h-4 text-gray-300" />;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Target className="w-4 h-4 text-teal-500" />
        <span className="text-sm font-semibold text-gray-900">Meine Abschlussquote</span>
        {loading && <span className="w-2.5 h-2.5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin ml-auto" />}
      </div>

      {/* Hauptwert */}
      <div className="flex items-end justify-center gap-3 py-2">
        <div className="text-center">
          <div className={`text-5xl font-black ${rateColor}`}>{me?.quote_pct?.toFixed(1)}%</div>
          <div className="flex items-center justify-center gap-1 mt-1">
            {DeltaIcon}
            <span className="text-xs text-gray-400">Abschlussquote</span>
          </div>
        </div>
        <div className="text-center pb-1">
          <div className="text-3xl font-black text-gray-700">#{me?.rang}</div>
          <div className="text-[10px] text-gray-400">Rang</div>
        </div>
      </div>

      {/* Coaching */}
      <div className={`rounded-lg px-3 py-2 text-xs font-medium ${coachingColor}`}>{coaching}</div>

      {/* Team-Vergleich */}
      <div className="flex justify-between text-xs text-gray-500 px-1">
        <span>Team-Ø {data.team_avg_pct?.toFixed(1)}%</span>
        <span>Ziel ≥90%</span>
      </div>

      {/* Mini-Ranking */}
      <div className="space-y-1">
        {data.fahrer.map((f) => {
          const isMe = f.fahrer_id === driverId;
          const barColor = f.ampel === 'gruen' ? 'bg-emerald-400' : f.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-400';
          const tColor = f.ampel === 'gruen' ? 'text-emerald-600' : f.ampel === 'gelb' ? 'text-yellow-500' : 'text-red-500';
          return (
            <div key={f.fahrer_id} className={`flex items-center gap-2 rounded-lg px-1.5 py-0.5 ${isMe ? 'bg-blue-50 border border-blue-200' : ''}`}>
              <span className="text-xs text-gray-400 w-4 text-right">#{f.rang}</span>
              <span className={`text-xs w-20 truncate ${isMe ? 'font-bold text-blue-700' : 'text-gray-700'}`}>{f.fahrer_name}</span>
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${f.quote_pct}%` }} />
              </div>
              <span className={`text-xs font-bold w-10 text-right ${tColor}`}>{f.quote_pct?.toFixed(1)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
