'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, TrendingUp, TrendingDown, Minus, WifiOff } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  name: string;
  aktuell_pct: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  alert_count: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', name: 'Max M.',  aktuell_pct: 93, trend: 'steigend', alert: false },
    { fahrer_id: 'f2', name: 'Sara K.', aktuell_pct: 60, trend: 'fallend',  alert: true  },
    { fahrer_id: 'f3', name: 'Luca P.', aktuell_pct: 75, trend: 'stabil',   alert: false },
  ],
  alert_count: 1,
};

interface Props {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase3940MeinePuenktlichkeitTrend({ driverId, locationId, isOnline }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId || !isOnline) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-puenktlichkeit-trend?location_id=${locationId}`);
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
        <span>Offline – Pünktlichkeit nicht verfügbar</span>
      </div>
    );
  }

  const sorted = [...data.fahrer].sort((a, b) => b.aktuell_pct - a.aktuell_pct);
  const myIndex = sorted.findIndex(f => f.fahrer_id === driverId);
  const me = myIndex >= 0 ? sorted[myIndex] : sorted[0];
  const rang = myIndex >= 0 ? myIndex + 1 : 1;

  const ampel = me.aktuell_pct >= 85 ? 'gruen' : me.aktuell_pct >= 70 ? 'gelb' : 'rot';
  const tColor = ampel === 'gruen' ? 'text-emerald-600' : ampel === 'gelb' ? 'text-yellow-500' : 'text-red-500';
  const bgColor = ampel === 'gruen' ? 'bg-emerald-50' : ampel === 'gelb' ? 'bg-yellow-50' : 'bg-red-50';
  const borderColor = ampel === 'gruen' ? 'border-emerald-200' : ampel === 'gelb' ? 'border-yellow-200' : 'border-red-200';

  const coaching =
    ampel === 'gruen'
      ? 'Ausgezeichnet – halte diese Pünktlichkeit!'
      : ampel === 'gelb'
        ? 'Tipp: Frühzeitig losfahren verbessert deine Quote.'
        : 'Achtung: Deine Pünktlichkeit braucht dringend Aufmerksamkeit!';

  const DeltaIcon = me.trend === 'steigend'
    ? <TrendingUp className="w-5 h-5 text-emerald-500" />
    : me.trend === 'fallend'
      ? <TrendingDown className="w-5 h-5 text-red-400" />
      : <Minus className="w-5 h-5 text-gray-400" />;

  return (
    <div className={`bg-white rounded-xl border ${borderColor} p-4 space-y-3`}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-blue-500" />
        <span className="text-sm font-semibold text-gray-900">Meine Pünktlichkeit</span>
        {loading && <span className="w-2.5 h-2.5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin ml-auto" />}
      </div>

      {/* Hauptwert + Rang */}
      <div className={`rounded-xl p-4 ${bgColor} flex items-center justify-between`}>
        <div>
          <div className={`text-5xl font-black ${tColor}`}>{me.aktuell_pct}%</div>
          <div className="text-xs text-gray-500 mt-1">Pünktlichkeitsquote</div>
        </div>
        <div className="text-right flex flex-col items-end gap-1">
          <div className={`text-3xl font-black ${tColor}`}>#{rang}</div>
          <div className="text-[11px] text-gray-400">von {sorted.length}</div>
          {DeltaIcon}
        </div>
      </div>

      {/* Coaching */}
      <div className="text-[11px] text-gray-500 italic px-1">{coaching}</div>
    </div>
  );
}
