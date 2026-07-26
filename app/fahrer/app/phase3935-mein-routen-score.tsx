'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart2, TrendingUp, TrendingDown, Minus, WifiOff } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  routen_score: number;
  trend: 'besser' | 'gleich' | 'schlechter';
  level: 'hoch' | 'mittel' | 'niedrig';
  hinweis: string;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_ø_score: number;
  alert: boolean;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',  routen_score: 88, trend: 'besser',     level: 'hoch',    hinweis: 'Ausgezeichnet — Routen-Effizienz verbessert!' },
    { fahrer_id: 'f2', fahrer_name: 'Lisa B.', routen_score: 72, trend: 'gleich',     level: 'hoch',    hinweis: 'Effiziente Routen — weiter so!' },
    { fahrer_id: 'f3', fahrer_name: 'Tom K.',  routen_score: 51, trend: 'schlechter', level: 'mittel',  hinweis: 'Routen werden länger — Zonen prüfen.' },
    { fahrer_id: 'f4', fahrer_name: 'Jan S.',  routen_score: 28, trend: 'gleich',     level: 'niedrig', hinweis: 'Lange Routen — Tourenplanung überdenken.' },
  ],
  team_ø_score: 60,
  alert: false,
};

export function FahrerPhase3935MeinRoutenScore({
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
      const res = await fetch(`/api/delivery/admin/fahrer-routen-score?location_id=${locationId}`);
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
        <span className="text-sm">Routen-Score nicht verfügbar (offline)</span>
      </div>
    );
  }

  const sorted = [...data.fahrer].sort((a, b) => b.routen_score - a.routen_score);
  const me = sorted.find(f => f.fahrer_id === driverId) ?? sorted[0];
  const rang = sorted.indexOf(me) + 1;
  const gesamt = sorted.length;
  const ampel = me?.level === 'hoch' ? 'gruen' : me?.level === 'mittel' ? 'gelb' : 'rot';

  const tColor = ampel === 'gruen' ? 'text-emerald-600' : ampel === 'gelb' ? 'text-yellow-500' : 'text-red-500';
  const DeltaIcon = me?.trend === 'besser'
    ? <TrendingUp className="w-4 h-4 text-emerald-500" />
    : me?.trend === 'schlechter'
      ? <TrendingDown className="w-4 h-4 text-red-400" />
      : <Minus className="w-4 h-4 text-gray-300" />;

  const coachColor = ampel === 'gruen' ? 'bg-emerald-50 text-emerald-700' : ampel === 'gelb' ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <BarChart2 className="w-5 h-5 text-gray-500" />
        <h3 className="font-semibold text-gray-900 text-sm">Mein Routen-Score</h3>
        {loading && <span className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin ml-auto" />}
      </div>

      {/* Hauptwert */}
      <div className="flex flex-col items-center py-2 gap-1">
        <span className={`text-5xl font-black ${tColor}`}>{me?.routen_score ?? 0}<span className="text-2xl font-bold ml-1">/ 100</span></span>
        <div className="flex items-center gap-1.5">
          <span className="text-3xl font-bold text-gray-400">Rang {rang}</span>
          <span className="text-xl text-gray-300">/ {gesamt}</span>
          {DeltaIcon}
        </div>
        <span className="text-xs text-gray-400">Ziel ≥80</span>
      </div>

      {/* Coaching */}
      <div className={`rounded-lg px-3 py-2 text-xs ${coachColor}`}>
        {me?.hinweis ?? ''}
      </div>

      {/* Mini-Liste */}
      <div className="space-y-0.5">
        {sorted.map((f, idx) => {
          const isMe = f.fahrer_id === driverId;
          const fAmpel = f.level === 'hoch' ? 'gruen' : f.level === 'mittel' ? 'gelb' : 'rot';
          const fColor = fAmpel === 'gruen' ? 'text-emerald-600' : fAmpel === 'gelb' ? 'text-yellow-600' : 'text-red-500';
          return (
            <div
              key={f.fahrer_id}
              className={`flex items-center gap-2 text-xs px-2 py-1 rounded-md ${isMe ? 'bg-gray-100 font-semibold' : ''}`}
            >
              <span className="w-4 text-gray-400 font-mono text-[10px]">#{idx + 1}</span>
              <span className="flex-1 text-gray-700 truncate">{f.fahrer_name}</span>
              <span className={`font-bold ${fColor}`}>{f.routen_score}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
