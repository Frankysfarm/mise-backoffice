'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerPuenktlichkeitRow {
  fahrer_id: string;
  fahrer_name: string;
  puenktlichkeit_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  rang: number;
}

interface ApiResponse {
  fahrer: FahrerPuenktlichkeitRow[];
  team_avg_pct: number;
}

const COACHING: Record<string, string> = {
  gruen: 'Exzellente Pünktlichkeit! Du lieferst zuverlässig pünktlich — unsere Kunden danken es dir!',
  gelb: 'Solide Pünktlichkeit. Mit etwas mehr Puffer bei der Routenplanung kannst du in die Top-25% gelangen.',
  rot: 'Niedrige Pünktlichkeit! Plane mehr Pufferzeit ein und informiere Dispatch frühzeitig bei Verzögerungen.',
};

export function FahrerPhase3650MeinePuenktlichkeit({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [data, setData] = useState<ApiResponse | null>(null);

  const load = useCallback(async () => {
    if (!isOnline || !locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-puenktlichkeit?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
    } catch {}
  }, [locationId, isOnline]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!isOnline || !data) return null;

  const sorted = [...data.fahrer].sort((a, b) => b.puenktlichkeit_pct - a.puenktlichkeit_pct);
  const me = sorted.find(f => f.fahrer_id === driverId) ?? sorted[0];
  if (!me) return null;

  const myRang = sorted.findIndex(f => f.fahrer_id === me.fahrer_id) + 1;
  const total = sorted.length;
  const pct = total > 0 ? ((total - myRang + 1) / total) * 100 : 50;

  const valColor = me.ampel === 'gruen' ? 'text-blue-500' : me.ampel === 'gelb' ? 'text-orange-500' : 'text-red-500';
  const barColor = me.ampel === 'gruen' ? 'bg-blue-400' : me.ampel === 'gelb' ? 'bg-orange-400' : 'bg-red-500';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Clock className="w-5 h-5 text-blue-500" />
        <h3 className="font-semibold text-gray-900">Meine Pünktlichkeit</h3>
      </div>

      <div className="text-center space-y-1">
        <div className={`text-5xl font-black ${valColor}`}>
          {me.puenktlichkeit_pct}%
        </div>
        <div className="text-sm text-gray-500">Pünktlichkeitsquote</div>
        <div className={`text-3xl font-bold ${valColor}`}>
          Rang #{myRang}
        </div>
        <div className="flex items-center justify-center gap-1 text-sm text-gray-500">
          {me.rank_delta > 0 ? (
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          ) : me.rank_delta < 0 ? (
            <TrendingDown className="w-4 h-4 text-red-500" />
          ) : (
            <Minus className="w-4 h-4 text-gray-400" />
          )}
          <span>Team-Ø: {data.team_avg_pct.toFixed(1)}%</span>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-xs text-gray-500">
          <span>Rang-Position</span>
          <span>#{myRang} von {total}</span>
        </div>
        <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-3 rounded-full ${barColor}`}
            style={{ width: `${Math.max(pct, 5)}%` }}
          />
        </div>
      </div>

      <div className="text-xs text-gray-400 text-center">Ziel ≥90% · Letzte 30 Tage</div>

      <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{COACHING[me.ampel]}</p>
    </div>
  );
}
