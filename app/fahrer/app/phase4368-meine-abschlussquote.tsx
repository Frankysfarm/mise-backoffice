'use client';

import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

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
  gesamt: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   rang: 1, quote_pct: 97, rank_delta:  2, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f2', fahrer_name: 'Julia F.', rang: 2, quote_pct: 89, rank_delta: -1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, quote_pct: 76, rank_delta:  1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, quote_pct: 52, rank_delta:  0, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg_pct: 78,
  gesamt: 4,
};

interface Props { driverId: string; locationId: string | null; isOnline: boolean; }

export function FahrerPhase4368MeineAbschlussquote({ driverId, locationId, isOnline }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/delivery/admin/fahrer-abschlussquoten-ranking?location_id=${locationId}&driver_id=${driverId}`
      );
      if (res.ok) { const json = await res.json(); if (!json.error) setData(json); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId, driverId]);

  useEffect(() => { load(); const id = setInterval(load, 30 * 60 * 1000); return () => clearInterval(id); }, [load]);

  if (!isOnline) return null;

  const me = data.fahrer.find(f => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!me) return null;

  const pctColor = me.ampel === 'gruen' ? 'text-green-600' : me.ampel === 'gelb' ? 'text-yellow-600' : 'text-red-600';
  // INVERTED rank_delta: prevRang - rang; >0 = verbessert = TrendingUp emerald
  const delta = me.rank_delta > 0
    ? <TrendingUp className="w-4 h-4 text-emerald-500" />
    : me.rank_delta < 0
    ? <TrendingDown className="w-4 h-4 text-red-400" />
    : <Minus className="w-4 h-4 text-gray-300" />;

  const tip = me.ampel === 'gruen'
    ? 'Ausgezeichnet! Deine Abschlussquote ist top — mach weiter so.'
    : me.ampel === 'gelb'
    ? 'Tipp: Informiere Kunden aktiv bei Verzögerungen — das reduziert Stornierungen.'
    : 'Deine Abschlussquote ist niedrig. Versuche Lieferungen sorgfältig abzuschließen und den Kunden zu erreichen.';

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <CheckCircle className="w-4 h-4 text-green-600" />
        <span className="text-sm font-bold text-gray-800">Meine Abschlussquote</span>
        {loading && <span className="ml-auto w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
      </div>

      <div className="flex items-center justify-center gap-6">
        <div className="text-center">
          <div className={`text-5xl font-black ${pctColor}`}>{me.quote_pct}</div>
          <div className="text-xs text-gray-500">% Abschlussquote</div>
        </div>
        <div className="text-center">
          <div className={`text-2xl font-bold ${pctColor}`}>#{me.rang}</div>
          <div className="text-xs text-gray-500">von {data.gesamt}</div>
          <div className="flex justify-center mt-1">{delta}</div>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
        <span>Team-Ø</span>
        <span className="font-semibold text-gray-700">{data.team_avg_pct} %</span>
      </div>

      <div className="text-xs text-gray-600 bg-green-50 rounded-lg px-3 py-2 leading-relaxed">{tip}</div>
    </div>
  );
}
