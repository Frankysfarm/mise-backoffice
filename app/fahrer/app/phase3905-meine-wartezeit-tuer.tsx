'use client';

import { useState, useEffect, useCallback } from 'react';
import { DoorOpen, TrendingUp, TrendingDown, Minus, WifiOff } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  avg_wartezeit_min: number;
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_wartezeit_min: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f4', fahrer_name: 'Tom B.',   avg_wartezeit_min:  3.1, trend_delta: -1.1, ampel: 'gruen', alert: false },
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   avg_wartezeit_min:  4.2, trend_delta: -0.9, ampel: 'gruen', alert: false },
    { fahrer_id: 'f3', fahrer_name: 'Lena S.',  avg_wartezeit_min:  6.5, trend_delta:  0.5, ampel: 'gelb',  alert: false },
    { fahrer_id: 'f5', fahrer_name: 'Anna B.',  avg_wartezeit_min: 11.3, trend_delta:  0.5, ampel: 'rot',   alert: true  },
    { fahrer_id: 'f2', fahrer_name: 'Sarah K.', avg_wartezeit_min: 12.8, trend_delta:  3.3, ampel: 'rot',   alert: true  },
  ],
  team_avg_wartezeit_min: 7.6,
};

export function FahrerPhase3905MeineWartezeitTuer({
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
      const res = await fetch(`/api/delivery/admin/fahrer-wartezeit?location_id=${locationId}`);
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
        <span className="text-sm">Wartezeit nicht verfügbar (offline)</span>
      </div>
    );
  }

  const sorted = [...data.fahrer].sort((a, b) => a.avg_wartezeit_min - b.avg_wartezeit_min);
  const me = sorted.find(f => f.fahrer_id === driverId) ?? sorted[0];
  const rang = me ? sorted.indexOf(me) + 1 : 1;
  const gesamt = sorted.length;

  const tColor = me?.ampel === 'gruen' ? 'text-gray-700' : me?.ampel === 'gelb' ? 'text-yellow-500' : 'text-red-500';
  const DeltaIcon = me && me.trend_delta < 0
    ? <TrendingUp className="w-4 h-4 text-emerald-500" />
    : me && me.trend_delta > 0
      ? <TrendingDown className="w-4 h-4 text-red-400" />
      : <Minus className="w-4 h-4 text-gray-300" />;

  const coachMsg = me?.ampel === 'gruen'
    ? 'Kurze Wartezeiten – super Abstimmung!'
    : me?.ampel === 'gelb'
      ? 'Abholung früher ankündigen kann helfen.'
      : 'Bitte Koordination mit der Küche verbessern.';
  const coachColor = me?.ampel === 'gruen' ? 'bg-gray-50 text-gray-600' : me?.ampel === 'gelb' ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <DoorOpen className="w-5 h-5 text-gray-500" />
        <h3 className="font-semibold text-gray-900 text-sm">Meine Wartezeit</h3>
        {loading && <span className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin ml-auto" />}
      </div>

      {/* Hauptwert */}
      <div className="flex flex-col items-center py-2 gap-1">
        <span className={`text-5xl font-black ${tColor}`}>{me?.avg_wartezeit_min ?? 0}<span className="text-2xl font-bold ml-1">min</span></span>
        <div className="flex items-center gap-1.5">
          <span className="text-3xl font-bold text-gray-400">Rang {rang}</span>
          <span className="text-xl text-gray-300">/ {gesamt}</span>
          {DeltaIcon}
        </div>
        <span className="text-xs text-gray-400">Ziel ≤5 min</span>
      </div>

      {/* Coaching */}
      <div className={`rounded-lg px-3 py-2 text-xs ${coachColor}`}>
        {coachMsg}
      </div>

      {/* Mini-Liste */}
      <div className="space-y-0.5">
        {sorted.map((f, i) => {
          const isMe = f.fahrer_id === driverId;
          const fColor = f.ampel === 'gruen' ? 'text-gray-700' : f.ampel === 'gelb' ? 'text-yellow-600' : 'text-red-500';
          return (
            <div
              key={f.fahrer_id}
              className={`flex items-center gap-2 text-xs px-2 py-1 rounded-md ${isMe ? 'bg-gray-100 font-semibold' : ''}`}
            >
              <span className="w-4 text-gray-400 font-mono text-[10px]">#{i + 1}</span>
              <span className="flex-1 text-gray-700 truncate">{f.fahrer_name}</span>
              <span className={`font-bold ${fColor}`}>{f.avg_wartezeit_min} min</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
