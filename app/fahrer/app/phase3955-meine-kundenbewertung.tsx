'use client';

import { useState, useEffect, useCallback } from 'react';
import { Star, TrendingUp, TrendingDown, Minus, WifiOff } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_bewertung: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_bewertung: number;
  ziel_bewertung: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, avg_bewertung: 4.9, rank_delta:  1, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, avg_bewertung: 4.7, rank_delta:  0, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, avg_bewertung: 4.3, rank_delta: -1, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_bewertung: 3.8, rank_delta:  0, ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg_bewertung: 4.43,
  ziel_bewertung: 4.5,
};

export function FahrerPhase3955MeineKundenbewertung({
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
      const res = await fetch(`/api/delivery/admin/fahrer-kundenbewertung-ranking?location_id=${locationId}`);
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
        <span className="text-sm">Kundenbewertung nicht verfügbar (offline)</span>
      </div>
    );
  }

  const sorted = [...data.fahrer].sort((a, b) => b.avg_bewertung - a.avg_bewertung);
  const me = sorted.find(f => f.fahrer_id === driverId) ?? sorted[0];
  const rang = sorted.indexOf(me) + 1;
  const gesamt = sorted.length;
  const a = me?.ampel ?? 'gelb';

  const tColor = a === 'gruen' ? 'text-emerald-600' : a === 'gelb' ? 'text-yellow-500' : 'text-red-500';
  const DeltaIcon = (me?.rank_delta ?? 0) > 0
    ? <TrendingUp className="w-4 h-4 text-emerald-500" />
    : (me?.rank_delta ?? 0) < 0
      ? <TrendingDown className="w-4 h-4 text-red-400" />
      : <Minus className="w-4 h-4 text-gray-300" />;

  const coachMsg = a === 'gruen'
    ? 'Exzellente Bewertungen – weiter so!'
    : a === 'gelb'
      ? 'Freundlichkeit und Zuverlässigkeit steigern Bewertungen.'
      : 'Dringende Verbesserung: Kundenkontakt und Service intensivieren.';
  const coachColor = a === 'gruen' ? 'bg-gray-50 text-gray-600' : a === 'gelb' ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Star className="w-5 h-5 text-amber-500" />
        <h3 className="font-semibold text-gray-900 text-sm">Meine Kundenbewertung</h3>
        {loading && <span className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin ml-auto" />}
      </div>

      {/* Hauptwert */}
      <div className="flex flex-col items-center py-2 gap-1">
        <span className={`text-5xl font-black ${tColor}`}>
          {me?.avg_bewertung.toFixed(1)}<span className="text-xl font-bold ml-1">★</span>
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-3xl font-bold text-gray-400">Rang {rang}</span>
          <span className="text-xl text-gray-300">/ {gesamt}</span>
          {DeltaIcon}
        </div>
        <span className="text-xs text-gray-400">Ziel ≥{data.ziel_bewertung.toFixed(1)} ★/Lieferung</span>
      </div>

      {/* Coaching */}
      <div className={`rounded-lg px-3 py-2 text-xs ${coachColor}`}>
        {coachMsg}
      </div>

      {/* Mini-Liste */}
      <div className="space-y-0.5">
        {sorted.map((f, i) => {
          const isMe = f.fahrer_id === driverId;
          const fa = f.ampel;
          const fColor = fa === 'gruen' ? 'text-emerald-600' : fa === 'gelb' ? 'text-yellow-600' : 'text-red-500';
          return (
            <div
              key={f.fahrer_id}
              className={`flex items-center gap-2 text-xs px-2 py-1 rounded-md ${isMe ? 'bg-gray-100 font-semibold' : ''}`}
            >
              <span className="w-4 text-gray-400 font-mono text-[10px]">#{i + 1}</span>
              <span className="flex-1 text-gray-700 truncate">{f.fahrer_name}</span>
              <span className={`font-bold ${fColor}`}>{f.avg_bewertung.toFixed(1)} ★</span>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-[10px] text-gray-400 border-t border-gray-100 pt-1.5">
        <span>Team-Ø {data.team_avg_bewertung.toFixed(1)} ★</span>
        <span>Letzte 30 Tage</span>
      </div>
    </div>
  );
}
