'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, TrendingUp, TrendingDown, Minus, WifiOff } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_min: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_lang: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_min: number;
  ziel_min: number;
  gesamt: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, avg_min: 18, rank_delta: -1, ampel: 'gruen', alert_lang: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, avg_min: 22, rank_delta:  0, ampel: 'gruen', alert_lang: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, avg_min: 28, rank_delta:  1, ampel: 'gelb',  alert_lang: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_min: 36, rank_delta:  0, ampel: 'rot',   alert_lang: true  },
  ],
  team_avg_min: 26,
  ziel_min: 25,
  gesamt: 4,
};

export function FahrerPhase3900MeineLieferzeit({
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
      const res = await fetch(`/api/delivery/admin/fahrer-lieferzeit-durchschnitt?location_id=${locationId}`);
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
        <span className="text-sm">Lieferzeit nicht verfügbar (offline)</span>
      </div>
    );
  }

  const sorted = [...data.fahrer].sort((a, b) => a.rang - b.rang);
  const me = sorted.find(f => f.fahrer_id === driverId) ?? sorted[0];
  const rang = me?.rang ?? 1;
  const gesamt = data.gesamt || sorted.length;
  const ziel = data.ziel_min;

  const tColor = me?.ampel === 'gruen' ? 'text-blue-600' : me?.ampel === 'gelb' ? 'text-yellow-500' : 'text-red-500';
  const DeltaIcon = me && me.rank_delta < 0
    ? <TrendingUp className="w-4 h-4 text-emerald-500" />
    : me && me.rank_delta > 0
      ? <TrendingDown className="w-4 h-4 text-red-400" />
      : <Minus className="w-4 h-4 text-gray-300" />;

  const coachMsg = me?.ampel === 'gruen'
    ? 'Spitzentempo – Kunden freuen sich!'
    : me?.ampel === 'gelb'
      ? 'Routenwahl optimieren für schnellere Lieferungen.'
      : 'Bitte Routen und Stoppreihenfolge überprüfen.';
  const coachColor = me?.ampel === 'gruen' ? 'bg-blue-50 text-blue-700' : me?.ampel === 'gelb' ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Clock className="w-5 h-5 text-blue-500" />
        <h3 className="font-semibold text-gray-900 text-sm">Meine Ø Lieferzeit</h3>
        {loading && <span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin ml-auto" />}
      </div>

      {/* Hauptwert */}
      <div className="flex flex-col items-center py-2 gap-1">
        <span className={`text-5xl font-black ${tColor}`}>{me?.avg_min ?? 0}<span className="text-2xl font-bold ml-1">min</span></span>
        <div className="flex items-center gap-1.5">
          <span className="text-3xl font-bold text-gray-400">Rang {rang}</span>
          <span className="text-xl text-gray-300">/ {gesamt}</span>
          {DeltaIcon}
        </div>
        <span className="text-xs text-gray-400">Ziel ≤{ziel} min</span>
      </div>

      {/* Coaching */}
      <div className={`rounded-lg px-3 py-2 text-xs ${coachColor}`}>
        {coachMsg}
      </div>

      {/* Mini-Liste */}
      <div className="space-y-0.5">
        {sorted.map(f => {
          const isMe = f.fahrer_id === driverId;
          const fColor = f.ampel === 'gruen' ? 'text-blue-600' : f.ampel === 'gelb' ? 'text-yellow-600' : 'text-red-500';
          return (
            <div
              key={f.fahrer_id}
              className={`flex items-center gap-2 text-xs px-2 py-1 rounded-md ${isMe ? 'bg-blue-50 font-semibold' : ''}`}
            >
              <span className="w-4 text-gray-400 font-mono text-[10px]">#{f.rang}</span>
              <span className="flex-1 text-gray-700 truncate">{f.fahrer_name}</span>
              <span className={`font-bold ${fColor}`}>{f.avg_min} min</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
