'use client';

import { useState, useEffect, useCallback } from 'react';
import { Package, TrendingUp, TrendingDown, Minus, WifiOff } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  pakete_pro_stunde: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg: number;
  gesamt: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'm1', fahrer_name: 'Julia F.', rang: 1, pakete_pro_stunde: 4.8, rank_delta:  1, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'm2', fahrer_name: 'Sara K.',  rang: 2, pakete_pro_stunde: 3.9, rank_delta:  0, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'm3', fahrer_name: 'Max M.',   rang: 3, pakete_pro_stunde: 3.1, rank_delta: -1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'm4', fahrer_name: 'Tim B.',   rang: 4, pakete_pro_stunde: 2.2, rank_delta:  0, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg: 3.5,
  gesamt: 4,
};

interface Props {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase3965MeinePaketeProStunde({ driverId, locationId, isOnline }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId || !isOnline) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-pakete-pro-stunde?location_id=${locationId}`);
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
        <span>Offline – Paketquote nicht verfügbar</span>
      </div>
    );
  }

  const me = data.fahrer.find(f => f.fahrer_id === driverId) ?? data.fahrer[0];
  const gesamt = data.gesamt ?? data.fahrer.length;

  const tColor = me.ampel === 'gruen' ? 'text-purple-600' : me.ampel === 'gelb' ? 'text-yellow-500' : 'text-red-500';
  const bgColor = me.ampel === 'gruen' ? 'bg-purple-50' : me.ampel === 'gelb' ? 'bg-yellow-50' : 'bg-red-50';
  const borderColor = me.ampel === 'gruen' ? 'border-purple-200' : me.ampel === 'gelb' ? 'border-yellow-200' : 'border-red-200';

  const coaching =
    me.ampel === 'gruen'
      ? 'Top! Deine Paketquote ist ausgezeichnet.'
      : me.ampel === 'gelb'
        ? 'Tipp: Optimiere deine Routen für kürzere Stopps.'
        : 'Achtung: Deine Paketquote ist niedrig – steigere deine Effizienz.';

  const DeltaIcon = me.rank_delta < 0
    ? <TrendingUp className="w-5 h-5 text-emerald-500" />
    : me.rank_delta > 0
      ? <TrendingDown className="w-5 h-5 text-red-400" />
      : <Minus className="w-5 h-5 text-gray-400" />;

  return (
    <div className={`bg-white rounded-xl border ${borderColor} p-4 space-y-3`}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Package className="w-4 h-4 text-purple-500" />
        <span className="text-sm font-semibold text-gray-900">Meine Pakete/Stunde</span>
        {loading && <span className="w-2.5 h-2.5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin ml-auto" />}
      </div>

      {/* Hauptwert + Rang */}
      <div className={`rounded-xl p-4 ${bgColor} flex items-center justify-between`}>
        <div>
          <div className={`text-5xl font-black ${tColor}`}>{me.pakete_pro_stunde?.toFixed(1)}</div>
          <div className="text-xs text-gray-500 mt-1">Pakete/Stunde</div>
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
            className={`h-full rounded-full ${me.ampel === 'gruen' ? 'bg-purple-400' : me.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-400'}`}
            style={{ width: `${gesamt > 1 ? ((gesamt - me.rang) / (gesamt - 1)) * 100 : 100}%` }}
          />
        </div>
      </div>

      {/* Ziel + Team-Avg */}
      <div className="flex items-center justify-between text-xs text-gray-500 px-1">
        <span>Ziel ≥4.0/h</span>
        <span className="font-medium text-gray-600">Team-Ø {data.team_avg?.toFixed(1)}/h</span>
      </div>

      {/* Coaching */}
      <div className="text-[11px] text-gray-500 italic px-1">{coaching}</div>
    </div>
  );
}
