'use client';

import { useState, useEffect, useCallback } from 'react';
import { Star, TrendingUp, TrendingDown, Minus, WifiOff } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_sterne: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_schlecht: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_sterne: number;
  gesamt: number;
  ziel_sterne: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   rang: 1, avg_sterne: 4.9, rank_delta:  0, ampel: 'gruen', alert_schlecht: false },
    { fahrer_id: 'f2', fahrer_name: 'Julia F.', rang: 2, avg_sterne: 4.5, rank_delta:  1, ampel: 'gruen', alert_schlecht: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, avg_sterne: 3.8, rank_delta: -1, ampel: 'gelb',  alert_schlecht: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_sterne: 2.9, rank_delta:  0, ampel: 'rot',   alert_schlecht: true  },
  ],
  team_avg_sterne: 4.0,
  gesamt: 4,
  ziel_sterne: 4.0,
};

interface Props {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase3955MeinBewertungsScore({ driverId, locationId, isOnline }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId || !isOnline) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-bewertungs-score-ranking?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
    } catch {
      // Mock-Fallback
    } finally {
      setLoading(false);
    }
  }, [locationId, isOnline]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!isOnline) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-2 text-gray-400 text-sm">
        <WifiOff className="w-4 h-4" />
        <span>Offline – Bewertungs-Score nicht verfügbar</span>
      </div>
    );
  }

  const me = data.fahrer.find(f => f.fahrer_id === driverId) ?? data.fahrer[0];
  const gesamt = data.gesamt ?? data.fahrer.length;

  const tColor = me.ampel === 'gruen' ? 'text-amber-600' : me.ampel === 'gelb' ? 'text-yellow-500' : 'text-red-500';
  const bgColor = me.ampel === 'gruen' ? 'bg-amber-50' : me.ampel === 'gelb' ? 'bg-yellow-50' : 'bg-red-50';
  const borderColor = me.ampel === 'gruen' ? 'border-amber-200' : me.ampel === 'gelb' ? 'border-yellow-200' : 'border-red-200';

  const coaching =
    me.ampel === 'gruen'
      ? 'Hervorragend – Kunden lieben deinen Service!'
      : me.ampel === 'gelb'
        ? 'Tipp: Achte auf pünktliche Lieferung und freundlichen Kontakt.'
        : 'Achtung: Deine Bewertungen sind niedrig – verbessere deinen Service.';

  const DeltaIcon = me.rank_delta < 0
    ? <TrendingUp className="w-5 h-5 text-emerald-500" />
    : me.rank_delta > 0
      ? <TrendingDown className="w-5 h-5 text-red-400" />
      : <Minus className="w-5 h-5 text-gray-400" />;

  return (
    <div className={`bg-white rounded-xl border ${borderColor} p-4 space-y-3`}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Star className="w-4 h-4 text-amber-500" />
        <span className="text-sm font-semibold text-gray-900">Mein Bewertungs-Score</span>
        {loading && <span className="w-2.5 h-2.5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin ml-auto" />}
      </div>

      {/* Hauptwert + Rang */}
      <div className={`rounded-xl p-4 ${bgColor} flex items-center justify-between`}>
        <div>
          <div className={`text-5xl font-black ${tColor}`}>{me.avg_sterne?.toFixed(1)}★</div>
          <div className="text-xs text-gray-500 mt-1">Ø Kundenbewertung (1–5★)</div>
        </div>
        <div className="text-right flex flex-col items-end gap-1">
          <div className={`text-3xl font-black ${tColor}`}>#{me.rang}</div>
          <div className="text-[11px] text-gray-400">von {gesamt}</div>
          {DeltaIcon}
        </div>
      </div>

      {/* Rang-Balken */}
      <div className="space-y-1 px-1">
        <div className="flex justify-between text-[10px] text-gray-400">
          <span>#1 Bester</span>
          <span>#{gesamt} Niedrigster</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${me.ampel === 'gruen' ? 'bg-amber-400' : me.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-400'}`}
            style={{ width: `${gesamt > 1 ? ((gesamt - me.rang) / (gesamt - 1)) * 100 : 100}%` }}
          />
        </div>
      </div>

      {/* Ziel + Team-Avg */}
      <div className="flex items-center justify-between text-xs text-gray-500 px-1">
        <span>Ziel ≥{data.ziel_sterne?.toFixed(1)}★</span>
        <span className="font-medium text-gray-600">Team-Ø {data.team_avg_sterne?.toFixed(1)}★</span>
      </div>

      {/* Coaching */}
      <div className="text-[11px] text-gray-500 italic px-1">{coaching}</div>
    </div>
  );
}
