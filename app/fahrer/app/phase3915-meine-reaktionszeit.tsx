'use client';

import { useState, useEffect, useCallback } from 'react';
import { Timer, TrendingUp, TrendingDown, Minus, WifiOff } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  name: string;
  avg_reaktionszeit_min: number;
  rang: number;
  trend: 'besser' | 'gleich' | 'schlechter';
  status: 'schnell' | 'normal' | 'langsam';
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_min: number;
  sla_ziel_min: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', name: 'Max M.',  avg_reaktionszeit_min: 2.4, rang: 1, trend: 'besser',     status: 'schnell' },
    { fahrer_id: 'f2', name: 'Anna S.', avg_reaktionszeit_min: 4.7, rang: 2, trend: 'gleich',     status: 'normal'  },
    { fahrer_id: 'f3', name: 'Tom B.',  avg_reaktionszeit_min: 7.2, rang: 3, trend: 'schlechter', status: 'langsam' },
  ],
  team_avg_min: 4.8,
  sla_ziel_min: 5,
};

export function FahrerPhase3915MeineReaktionszeit({
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
      const res = await fetch(`/api/delivery/admin/fahrer-reaktionszeit-statistik?location_id=${locationId}`);
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
        <span className="text-sm">Reaktionszeit nicht verfügbar (offline)</span>
      </div>
    );
  }

  const sorted = [...data.fahrer].sort((a, b) => a.avg_reaktionszeit_min - b.avg_reaktionszeit_min);
  const me = sorted.find(f => f.fahrer_id === driverId) ?? sorted[0];
  const rang = me?.rang ?? sorted.indexOf(me) + 1;
  const gesamt = sorted.length;

  const tColor = me?.status === 'schnell' ? 'text-emerald-600' : me?.status === 'normal' ? 'text-yellow-500' : 'text-red-500';
  const DeltaIcon = me?.trend === 'besser'
    ? <TrendingUp className="w-4 h-4 text-emerald-500" />
    : me?.trend === 'schlechter'
      ? <TrendingDown className="w-4 h-4 text-red-400" />
      : <Minus className="w-4 h-4 text-gray-300" />;

  const coachMsg = me?.status === 'schnell'
    ? 'Sehr schnelle Reaktionszeiten – weiter so!'
    : me?.status === 'normal'
      ? 'Benachrichtigungen aktiv halten für schnellere Reaktion.'
      : 'Bitte Benachrichtigungen prüfen und App im Vordergrund halten.';
  const coachColor = me?.status === 'schnell' ? 'bg-emerald-50 text-emerald-700' : me?.status === 'normal' ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Timer className="w-5 h-5 text-gray-500" />
        <h3 className="font-semibold text-gray-900 text-sm">Meine Reaktionszeit</h3>
        {loading && <span className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin ml-auto" />}
      </div>

      {/* Hauptwert */}
      <div className="flex flex-col items-center py-2 gap-1">
        <span className={`text-5xl font-black ${tColor}`}>{me?.avg_reaktionszeit_min ?? 0}<span className="text-2xl font-bold ml-1">min</span></span>
        <div className="flex items-center gap-1.5">
          <span className="text-3xl font-bold text-gray-400">Rang {rang}</span>
          <span className="text-xl text-gray-300">/ {gesamt}</span>
          {DeltaIcon}
        </div>
        <span className="text-xs text-gray-400">Ziel ≤{data.sla_ziel_min} min</span>
      </div>

      {/* Coaching */}
      <div className={`rounded-lg px-3 py-2 text-xs ${coachColor}`}>
        {coachMsg}
      </div>

      {/* Mini-Liste */}
      <div className="space-y-0.5">
        {sorted.map(f => {
          const isMe = f.fahrer_id === driverId;
          const fColor = f.status === 'schnell' ? 'text-emerald-600' : f.status === 'normal' ? 'text-yellow-600' : 'text-red-500';
          return (
            <div
              key={f.fahrer_id}
              className={`flex items-center gap-2 text-xs px-2 py-1 rounded-md ${isMe ? 'bg-gray-100 font-semibold' : ''}`}
            >
              <span className="w-4 text-gray-400 font-mono text-[10px]">#{f.rang}</span>
              <span className="flex-1 text-gray-700 truncate">{f.name}</span>
              <span className={`font-bold ${fColor}`}>{f.avg_reaktionszeit_min} min</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
