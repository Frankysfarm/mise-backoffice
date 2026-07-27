'use client';

import { useState, useEffect, useCallback } from 'react';
import { Coins, TrendingUp, TrendingDown, Minus, WifiOff } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_tip_eur: number;
  tip_count: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_eur: number;
  gesamt: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, avg_tip_eur: 3.20, tip_count: 25, rank_delta:  0, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, avg_tip_eur: 2.50, tip_count: 20, rank_delta:  1, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, avg_tip_eur: 1.80, tip_count: 18, rank_delta: -1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_tip_eur: 0.90, tip_count: 12, rank_delta:  0, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg_eur: 2.10,
  gesamt: 4,
};

function fmt(v: number) {
  return v.toFixed(2).replace('.', ',') + ' €';
}

interface Props {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase3980MeinTrinkgeld({ driverId, locationId, isOnline }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId || !isOnline) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-trinkgeld-ranking?location_id=${locationId}`);
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
        <span>Offline – Trinkgeld nicht verfügbar</span>
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
      ? 'Spitze! Kunden honorieren deine freundliche Art.'
      : me.ampel === 'gelb'
        ? 'Tipp: Freundlichkeit und Sorgfalt steigern das Trinkgeld.'
        : 'Achtung: Wenig Trinkgeld – Kunden-Interaktion verbessern!';

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
        <Coins className="w-4 h-4 text-amber-500" />
        <span className="text-sm font-semibold text-gray-900">Mein Trinkgeld heute</span>
        {loading && <span className="w-2.5 h-2.5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin ml-auto" />}
      </div>

      {/* Hauptwert + Rang */}
      <div className={`rounded-xl p-4 ${bgColor} flex items-center justify-between`}>
        <div>
          <div className={`text-5xl font-black ${tColor}`}>{fmt(me.avg_tip_eur)}</div>
          <div className="text-xs text-gray-500 mt-1">Ø pro Lieferung · {me.tip_count}× erhalten</div>
        </div>
        <div className="text-right flex flex-col items-end gap-1">
          <div className={`text-3xl font-black ${tColor}`}>#{me.rang}</div>
          <div className="text-[11px] text-gray-400">von {gesamt}</div>
          {DeltaIcon}
        </div>
      </div>

      {/* Ziel */}
      <div className="flex items-center justify-between text-xs text-gray-500 px-1">
        <span>Ø Trinkgeld pro Lieferung</span>
        <span className="font-medium text-gray-600">Team-Ø {fmt(data.team_avg_eur)}</span>
      </div>

      {/* Coaching */}
      <div className="text-[11px] text-gray-500 italic px-1">{coaching}</div>
    </div>
  );
}
