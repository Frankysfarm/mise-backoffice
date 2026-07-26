'use client';

import { useState, useEffect, useCallback } from 'react';
import { Truck, TrendingUp, TrendingDown, Minus, WifiOff } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_min: number;
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
    { fahrer_id: 'm1', fahrer_name: 'Julia F.', rang: 1, avg_min: 18, rank_delta: -1, ampel: 'gruen', alert_top: false },
    { fahrer_id: 'm2', fahrer_name: 'Sara K.',  rang: 2, avg_min: 22, rank_delta:  0, ampel: 'gruen', alert_top: false },
    { fahrer_id: 'm3', fahrer_name: 'Max M.',   rang: 3, avg_min: 28, rank_delta:  1, ampel: 'gelb',  alert_top: false },
    { fahrer_id: 'm4', fahrer_name: 'Tim B.',   rang: 4, avg_min: 36, rank_delta:  0, ampel: 'rot',   alert_top: true  },
  ],
  team_avg: 26,
  gesamt: 4,
};

interface Props {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase3960MeineLieferzeit({ driverId, locationId, isOnline }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId || !isOnline) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-durchschnitts-lieferzeit-ranking?location_id=${locationId}`);
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
        <span>Offline – Lieferzeit nicht verfügbar</span>
      </div>
    );
  }

  const me = data.fahrer.find(f => f.fahrer_id === driverId) ?? data.fahrer[0];
  const gesamt = data.gesamt ?? data.fahrer.length;

  const tColor = me.ampel === 'gruen' ? 'text-emerald-600' : me.ampel === 'gelb' ? 'text-yellow-500' : 'text-red-500';
  const bgColor = me.ampel === 'gruen' ? 'bg-emerald-50' : me.ampel === 'gelb' ? 'bg-yellow-50' : 'bg-red-50';
  const borderColor = me.ampel === 'gruen' ? 'border-emerald-200' : me.ampel === 'gelb' ? 'border-yellow-200' : 'border-red-200';

  const coaching =
    me.ampel === 'gruen'
      ? 'Schnelle Lieferung – Kunden sind begeistert!'
      : me.ampel === 'gelb'
        ? 'Tipp: Direktere Routen reduzieren die Lieferzeit.'
        : 'Achtung: Hohe Lieferzeit – Route optimieren!';

  // rank_delta < 0 = improved position = TrendUp green (UNIVERSAL)
  const DeltaIcon = me.rank_delta < 0
    ? <TrendingUp className="w-5 h-5 text-emerald-500" />
    : me.rank_delta > 0
      ? <TrendingDown className="w-5 h-5 text-red-400" />
      : <Minus className="w-5 h-5 text-gray-400" />;

  return (
    <div className={`bg-white rounded-xl border ${borderColor} p-4 space-y-3`}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Truck className="w-4 h-4 text-slate-500" />
        <span className="text-sm font-semibold text-gray-900">Meine Lieferzeit</span>
        {loading && <span className="w-2.5 h-2.5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin ml-auto" />}
      </div>

      {/* Hauptwert + Rang */}
      <div className={`rounded-xl p-4 ${bgColor} flex items-center justify-between`}>
        <div>
          <div className={`text-5xl font-black ${tColor}`}>{me.avg_min}</div>
          <div className="text-xs text-gray-500 mt-1">Ø min je Lieferung</div>
        </div>
        <div className="text-right flex flex-col items-end gap-1">
          <div className={`text-3xl font-black ${tColor}`}>#{me.rang}</div>
          <div className="text-[11px] text-gray-400">von {gesamt}</div>
          {DeltaIcon}
        </div>
      </div>

      {/* Ziel */}
      <div className="flex items-center justify-between text-xs text-gray-500 px-1">
        <span>Ziel ≤25 min</span>
        <span className="font-medium text-gray-600">Team-Ø {data.team_avg} min</span>
      </div>

      {/* Coaching */}
      <div className="text-[11px] text-gray-500 italic px-1">{coaching}</div>
    </div>
  );
}
