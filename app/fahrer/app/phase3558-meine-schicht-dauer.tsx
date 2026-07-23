'use client';

import { useState, useEffect, useCallback } from 'react';
import { Timer, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  dauer_min: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_top: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg: number;
  gesamt: number;
}

const COACHING: Record<string, string> = {
  gruen: 'Kurze Schicht-Dauer — effizient und fokussiert!',
  gelb: 'Gute Schicht-Dauer — etwas kürzer wäre ideal.',
  rot: 'Lange Schichten belasten dich. Strukturiere deine Schichten effizienter.',
};

const AMPEL_TEXT: Record<string, string> = {
  gruen: 'text-green-600',
  gelb: 'text-yellow-600',
  rot: 'text-red-600',
};

export function FahrerPhase3558MeineSchichtDauer({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [data, setData] = useState<ApiResponse | null>(null);

  const fetchData = useCallback(async () => {
    if (!isOnline) return;
    try {
      const url = locationId
        ? `/api/delivery/admin/fahrer-schicht-dauer?location_id=${locationId}`
        : '/api/delivery/admin/fahrer-schicht-dauer';
      const res = await fetch(url);
      if (!res.ok) return;
      setData(await res.json());
    } catch {
      // keep stale
    }
  }, [isOnline, locationId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (!isOnline || !data) return null;

  const me = data.fahrer.find(f => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!me) return null;

  const barPct = data.gesamt > 1 ? Math.round(((data.gesamt - me.rang) / (data.gesamt - 1)) * 100) : 100;

  return (
    <div className="rounded-xl border bg-white shadow-sm p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Timer className="w-5 h-5 text-purple-500" />
        <span className="font-semibold text-gray-800">Meine Schicht-Dauer</span>
      </div>

      <div className="flex items-end gap-4">
        <span className={`text-5xl font-bold ${AMPEL_TEXT[me.ampel]}`}>
          {me.dauer_min} min
        </span>
        <span className={`text-3xl font-semibold ml-auto ${AMPEL_TEXT[me.ampel]}`}>
          #{me.rang}
        </span>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-xs text-gray-500">
          <span>Rang {me.rang} von {data.gesamt}</span>
          <span>Team-Ø {data.team_avg} min</span>
        </div>
        <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
          <div
            className={`h-2 rounded-full ${me.ampel === 'gruen' ? 'bg-green-400' : me.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-400'}`}
            style={{ width: `${barPct}%` }}
          />
        </div>
      </div>

      <div className="flex items-center gap-1 text-xs text-gray-500">
        {me.rank_delta === 0 ? (
          <Minus className="w-3 h-3" />
        ) : me.rank_delta < 0 ? (
          <TrendingUp className="w-3 h-3 text-green-500" />
        ) : (
          <TrendingDown className="w-3 h-3 text-red-500" />
        )}
        <span>{me.rank_delta === 0 ? 'Unverändert' : me.rank_delta < 0 ? `${Math.abs(me.rank_delta)} Plätze verbessert` : `${me.rank_delta} Plätze zurückgefallen`}</span>
      </div>

      <p className="text-xs text-gray-600 bg-gray-50 rounded-lg p-2 italic">
        {COACHING[me.ampel]}
      </p>
    </div>
  );
}
