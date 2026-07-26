'use client';

import { useState, useEffect, useCallback } from 'react';
import { XCircle, TrendingUp, TrendingDown, Minus, WifiOff } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  storno_rate_pct: number;
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_storno_rate_pct: number;
  alert_count: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f4', fahrer_name: 'Tom B.',   storno_rate_pct:  2.1, trend_delta: -0.9, ampel: 'gruen', alert: false },
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   storno_rate_pct:  3.2, trend_delta: -0.8, ampel: 'gruen', alert: false },
    { fahrer_id: 'f3', fahrer_name: 'Lena S.',  storno_rate_pct:  8.7, trend_delta:  1.2, ampel: 'gelb',  alert: false },
    { fahrer_id: 'f2', fahrer_name: 'Sarah K.', storno_rate_pct: 18.5, trend_delta:  6.5, ampel: 'rot',   alert: true  },
    { fahrer_id: 'f5', fahrer_name: 'Jana F.',  storno_rate_pct: 21.4, trend_delta:  3.4, ampel: 'rot',   alert: true  },
  ],
  team_avg_storno_rate_pct: 10.8,
  alert_count: 2,
};

export function FahrerPhase3920MeineStornoRate({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId || !isOnline) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-storno-rate?location_id=${locationId}`);
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
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 text-gray-400">
        <WifiOff className="w-5 h-5 shrink-0" />
        <span className="text-sm">Storno-Rate nicht verfügbar (offline)</span>
      </div>
    );
  }

  const sorted = [...data.fahrer].sort((a, b) => a.storno_rate_pct - b.storno_rate_pct);
  const me = sorted.find(f => f.fahrer_id === driverId) ?? sorted[0];
  const rang = sorted.indexOf(me) + 1;
  const gesamt = sorted.length;

  const tColor = me?.ampel === 'gruen' ? 'text-gray-700' : me?.ampel === 'gelb' ? 'text-yellow-500' : 'text-red-500';
  const DeltaIcon = me && me.trend_delta < 0
    ? <TrendingUp className="w-4 h-4 text-emerald-500" />
    : me && me.trend_delta > 0
      ? <TrendingDown className="w-4 h-4 text-red-400" />
      : <Minus className="w-4 h-4 text-gray-300" />;

  const coachMsg = me?.ampel === 'gruen'
    ? 'Sehr niedrige Storno-Rate – weiter so!'
    : me?.ampel === 'gelb'
      ? 'Stornierungen reduzieren durch bessere Routenplanung.'
      : 'Bitte Touren sorgfältig prüfen und Stornierungen vermeiden.';
  const coachColor = me?.ampel === 'gruen' ? 'bg-gray-50 text-gray-600' : me?.ampel === 'gelb' ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <XCircle className="w-5 h-5 text-red-400" />
        <h3 className="font-semibold text-gray-900 text-sm">Meine Storno-Rate</h3>
        {loading && <span className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin ml-auto" />}
      </div>

      {/* Hauptwert */}
      <div className="flex flex-col items-center py-2 gap-1">
        <span className={`text-5xl font-black ${tColor}`}>{me?.storno_rate_pct ?? 0}<span className="text-2xl font-bold ml-1">%</span></span>
        <div className="flex items-center gap-1.5">
          <span className="text-3xl font-bold text-gray-400">Rang {rang}</span>
          <span className="text-xl text-gray-300">/ {gesamt}</span>
          {DeltaIcon}
        </div>
        <span className="text-xs text-gray-400">Ziel ≤5%</span>
      </div>

      {/* Coaching */}
      <div className={`rounded-lg px-3 py-2 text-xs ${coachColor}`}>
        {coachMsg}
      </div>

      {/* Mini-Liste */}
      <div className="space-y-0.5">
        {sorted.map((f, idx) => {
          const isMe = f.fahrer_id === driverId;
          const fColor = f.ampel === 'gruen' ? 'text-gray-700' : f.ampel === 'gelb' ? 'text-yellow-600' : 'text-red-500';
          return (
            <div
              key={f.fahrer_id}
              className={`flex items-center gap-2 text-xs px-2 py-1 rounded-md ${isMe ? 'bg-gray-100 font-semibold' : ''}`}
            >
              <span className="w-4 text-gray-400 font-mono text-[10px]">#{idx + 1}</span>
              <span className="flex-1 text-gray-700 truncate">{f.fahrer_name}</span>
              <span className={`font-bold ${fColor}`}>{f.storno_rate_pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
